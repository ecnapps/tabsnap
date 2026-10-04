@echo off
set "FECHA=%date:/=-%_%time::=-%"
git add .
git commit -m "Update %FECHA%"
git push
