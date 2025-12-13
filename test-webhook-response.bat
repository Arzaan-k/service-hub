@echo off
echo 🚀 Testing WhatsApp webhook response...
echo.

echo 1. Testing with test-webhook endpoint (simpler):
curl -X POST https://82e26a90de64.ngrok-free.app/api/whatsapp/test-webhook -H "Content-Type: application/json" -d "{\"message\": \"hi\", \"from\": \"7021307474\"}"
echo.
echo.

echo 2. Testing with full Meta payload:
curl -X POST https://82e26a90de64.ngrok-free.app/api/whatsapp/webhook -H "Content-Type: application/json" -H "User-Agent: facebookexternalua" -d "{\"entry\": [{\"changes\": [{\"value\": {\"messages\": [{\"from\": \"7021307474\", \"id\": \"wamid.test123\", \"timestamp\": \"1700000000\", \"text\": {\"body\": \"hi\"}, \"type\": \"text\"}], \"contacts\": [{\"profile\": {\"name\": \"Test User\"}, \"wa_id\": \"7021307474\"}], \"metadata\": {\"display_phone_number\": \"15551234567\", \"phone_number_id\": \"899316023263323\"}}, \"field\": \"messages\"}], \"id\": \"851697950903636\", \"messaging\": []}], \"object\": \"whatsapp_business_account\"}"

echo.
echo ✅ Test completed!
echo 🔍 Check your server logs and WhatsApp for response
pause
