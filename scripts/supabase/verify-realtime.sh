#!/bin/bash
# Verification script for Supabase Realtime configuration
# This script checks that required tables are configured for Realtime replication

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Required tables for realtime
REQUIRED_TABLES=(
  "lobby_presence"
  "matches"
  "rounds"
  "move_submissions"
  "match_invitations"
)

# Get database URL
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo -e "${BLUE}🔍 Verifying Realtime Configuration...${NC}\n"

# Check publication tables
echo -e "${BLUE}📡 Checking supabase_realtime publication:${NC}"
PUBLICATION_QUERY="
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND schemaname = 'public'
ORDER BY tablename;
"

PUBLISHED_TABLES=$(psql "$DATABASE_URL" -t -A -c "$PUBLICATION_QUERY" 2>/dev/null || echo "")

if [ -z "$PUBLISHED_TABLES" ]; then
  echo -e "   ${RED}❌ No tables found in supabase_realtime publication${NC}"
  echo -e "   ${YELLOW}💡 This likely means the publication doesn't exist or is empty${NC}"
  echo ""
  echo -e "   ${YELLOW}Run the migration:${NC}"
  echo -e "   ${YELLOW}supabase db reset${NC}"
  echo ""
  PUBLICATION_ERROR=1
else
  PUBLICATION_ERROR=0
  for table in "${REQUIRED_TABLES[@]}"; do
    if echo "$PUBLISHED_TABLES" | grep -q "^$table$"; then
      echo -e "   ${GREEN}✅ $table - published${NC}"
    else
      echo -e "   ${RED}❌ $table - NOT published${NC}"
      PUBLICATION_ERROR=1
    fi
  done
fi

# Check replica identity settings
echo -e "\n${BLUE}🔄 Checking replica identity settings:${NC}"
REPLICA_QUERY="
SELECT c.relname as tablename, 
       CASE c.relreplident
         WHEN 'd' THEN 'default'
         WHEN 'f' THEN 'full'
         WHEN 'n' THEN 'nothing'
         WHEN 'i' THEN 'index'
       END as identity_type,
       c.relreplident
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('$(IFS=\',\'; echo "${REQUIRED_TABLES[*]}")')
ORDER BY c.relname;
"

REPLICA_ERROR=0
for table in "${REQUIRED_TABLES[@]}"; do
  IDENTITY=$(psql "$DATABASE_URL" -t -A -c "
    SELECT c.relreplident
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = '$table';
  " 2>/dev/null || echo "")
  
  if [ -z "$IDENTITY" ]; then
    echo -e "   ${RED}❌ $table - table not found${NC}"
    REPLICA_ERROR=1
  elif [ "$IDENTITY" = "f" ]; then
    echo -e "   ${GREEN}✅ $table - full (all columns)${NC}"
  else
    IDENTITY_NAME="unknown"
    case "$IDENTITY" in
      d) IDENTITY_NAME="default (primary key only)" ;;
      n) IDENTITY_NAME="nothing (disabled)" ;;
      i) IDENTITY_NAME="index" ;;
    esac
    echo -e "   ${YELLOW}⚠️  $table - $IDENTITY_NAME${NC}"
    echo -e "      ${YELLOW}💡 Run: ALTER TABLE public.$table REPLICA IDENTITY FULL;${NC}"
    REPLICA_ERROR=1
  fi
done

# Summary
echo ""
if [ $PUBLICATION_ERROR -eq 0 ] && [ $REPLICA_ERROR -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Realtime is properly configured.${NC}"
  exit 0
else
  echo -e "${RED}❌ Realtime configuration incomplete${NC}"
  echo ""
  echo -e "${YELLOW}To fix, run:${NC}"
  echo -e "  ${YELLOW}supabase migration up${NC}"
  echo -e "  ${YELLOW}# or${NC}"
  echo -e "  ${YELLOW}supabase db reset${NC}"
  echo ""
  exit 1
fi

