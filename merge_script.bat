@echo off
cd /d C:\Users\Amit\service-hub

echo === Step 1: Fetch latest changes from origin ===
git fetch origin

echo.
echo === Step 2: Current Branch Status ===
git status

echo.
echo === Step 3: Checkout main branch ===
git checkout main

echo.
echo === Step 4: Pull latest main from origin ===
git pull origin main

echo.
echo === Step 5: Show differences between main and PMoverall ===
git log --oneline main..PMoverall

echo.
echo === Step 6: Merge PMoverall into main ===
git merge PMoverall --no-edit -m "Merge PMoverall: pm overall summarize feature"

echo.
echo === Step 7: Show merge status ===
git status

echo.
echo === Step 8: Push to origin main ===
git push origin main

echo.
echo === DONE! ===
echo Check the output above for any errors.
pause

