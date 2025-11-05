#!/bin/sh
echo "$1"
pandoc --pdf-engine=xelatex \
    -V 'mainfont:LiberationSans-Bold.ttf' \
    -V 'geometry:margin=.25in' \
    -o /tmp/md2rmn.pdf \
    $1
gs -dSAFER \
    -r350 \
    -sPAPERSIZE=a4 \
    -sDEVICE=pnggray \
    -o /tmp/md2rmn.png \
    /tmp/md2rmn.pdf
echo image /tmp/md2rmn.png | drawj2d \
    -Trmn \
    -o "$1.rmn"
rcu --autoconnect --cli --upload-doc "$1.rmn"
