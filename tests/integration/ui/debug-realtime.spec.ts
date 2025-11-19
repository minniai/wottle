import { expect, test } from "@playwright/test";

/**
 * Debug test to isolate Realtime connection issues
 * 
 * This test attempts to connect to Supabase Realtime directly
 * without any application logic to determine if the issue is
 * with the Realtime service itself or with how the app uses it.
 */

interface RealtimeTestResult {
  success: boolean;
  status: string;
  logs: string[];
  errors: string[];
  presenceState?: Record<string, unknown>;
}

test.describe("Realtime Debug", () => {
  test("can connect to Supabase Realtime service", async ({ page }) => {
    await page.goto("/");
    
    const result = await page.evaluate(async (): Promise<RealtimeTestResult> => {
      const logs: string[] = [];
      const errors: string[] = [];
      
      try {
        // Get Supabase client from window (injected by app)
        // @ts-ignore
        const supabaseModule = await import("/node_modules/@supabase/supabase-js/dist/module/index.js");
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        
        logs.push(`URL: ${supabaseUrl}`);
        logs.push(`Key: ${supabaseKey.substring(0, 20)}...`);
        
        if (!supabaseKey) {
          errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined");
          return { success: false, status: "NO_KEY", logs, errors };
        }
        
        const client = supabaseModule.createClient(supabaseUrl, supabaseKey);
        logs.push("Client created");
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({
              success: false,
              status: "TIMEOUT",
              logs: [...logs, "Timeout after 10 seconds"],
              errors,
            });
          }, 10000);
          
          const channel = client.channel("debug-test-channel");
          logs.push("Channel created");
          
          channel.subscribe((status: string) => {
            logs.push(`Status: ${status}`);
            
            if (status === "SUBSCRIBED") {
              clearTimeout(timeout);
              resolve({
                success: true,
                status: "SUBSCRIBED",
                logs,
                errors,
              });
            } else if (status === "CHANNEL_ERROR") {
              clearTimeout(timeout);
              errors.push("Got CHANNEL_ERROR status");
              resolve({
                success: false,
                status: "CHANNEL_ERROR",
                logs,
                errors,
              });
            } else if (status === "TIMED_OUT") {
              clearTimeout(timeout);
              errors.push("Channel connection timed out");
              resolve({
                success: false,
                status: "TIMED_OUT",
                logs,
                errors,
              });
            }
          });
        });
      } catch (error) {
        errors.push(`Exception: ${error}`);
        return {
          success: false,
          status: "EXCEPTION",
          logs,
          errors,
        };
      }
    });
    
    console.log("=== Realtime Debug Test Results ===");
    console.log("Success:", result.success);
    console.log("Status:", result.status);
    console.log("\nLogs:");
    result.logs.forEach((log: string) => console.log("  ", log));
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach((err: string) => console.log("  ", err));
    }
    console.log("===================================");
    
    expect(result.success).toBe(true);
    expect(result.status).toBe("SUBSCRIBED");
  });

  test("can use Realtime Presence feature", async ({ page }) => {
    await page.goto("/");
    
    const result = await page.evaluate(async (): Promise<RealtimeTestResult> => {
      const logs: string[] = [];
      const errors: string[] = [];
      
      try {
        // @ts-ignore
        const supabaseModule = await import("/node_modules/@supabase/supabase-js/dist/module/index.js");
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        
        const client = supabaseModule.createClient(supabaseUrl, supabaseKey);
        logs.push("Client created");
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({
              success: false,
              status: "TIMEOUT",
              logs: [...logs, "Timeout after 10 seconds"],
              errors,
            });
          }, 10000);
          
          const channel = client.channel("debug-presence-test", {
            config: {
              presence: {
                key: "test-user-123",
              },
            },
          });
          logs.push("Presence channel created");
          
          let subscribed = false;
          
          channel
            .on("presence", { event: "sync" }, () => {
              logs.push("Presence sync event received");
              const state = channel.presenceState();
              logs.push(`Presence state: ${JSON.stringify(Object.keys(state))}`);
            })
            .subscribe((status: string) => {
              logs.push(`Status: ${status}`);
              
              if (status === "SUBSCRIBED") {
                subscribed = true;
                logs.push("Attempting to track presence...");
                
                channel.track({
                  userId: "test-user-123",
                  username: "debug-tester",
                  online: true,
                });
                
                // Wait a bit to see if presence gets tracked
                setTimeout(() => {
                  const state = channel.presenceState();
                  logs.push(`Final presence state: ${JSON.stringify(state)}`);
                  
                  clearTimeout(timeout);
                  resolve({
                    success: true,
                    status: "SUBSCRIBED",
                    logs,
                    errors,
                    presenceState: state,
                  });
                }, 2000);
              } else if (status === "CHANNEL_ERROR") {
                clearTimeout(timeout);
                errors.push("Got CHANNEL_ERROR status");
                resolve({
                  success: false,
                  status: "CHANNEL_ERROR",
                  logs,
                  errors,
                });
              }
            });
        });
      } catch (error) {
        errors.push(`Exception: ${error}`);
        return {
          success: false,
          status: "EXCEPTION",
          logs,
          errors,
        };
      }
    });
    
    console.log("=== Realtime Presence Debug Test Results ===");
    console.log("Success:", result.success);
    console.log("Status:", result.status);
    console.log("\nLogs:");
    result.logs.forEach((log: string) => console.log("  ", log));
    if (result.errors.length > 0) {
      console.log("\nErrors:");
      result.errors.forEach((err: string) => console.log("  ", err));
    }
    console.log("===========================================");
    
    expect(result.success).toBe(true);
    expect(result.status).toBe("SUBSCRIBED");
  });
});

