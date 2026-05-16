@echo off
echo Starting DTG Rentals with ngrok tunnel...

:: Start ngrok with static domain in background
start "ngrok" cmd /k "ngrok http --domain=amber-trimester-juggling.ngrok-free.dev 8081"

:: Wait for ngrok to start
timeout /t 4 /nobreak > nul

:: Tell Expo to use the ngrok HTTPS URL as proxy
set EXPO_PACKAGER_PROXY_URL=https://amber-trimester-juggling.ngrok-free.dev
set REACT_NATIVE_PACKAGER_HOSTNAME=amber-trimester-juggling.ngrok-free.dev
npx expo start
