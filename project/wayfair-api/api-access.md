API Access Tokens

This guide explains how to use the Client ID and Client Secret from your application management to get a temporary Access Token. This token is required to make secure calls to any of Wayfair's APIs.
Understanding Access Tokens

What is an Access Token?

An access token is a temporary, secure credential that proves your system is authorized to communicate with Wayfair's APIs. You must include a valid access token with every API request you make.
Application Keys vs. Access Tokens

This is a key concept for understanding the security of our APIs:
Application Keys (Client ID & Secret): These are your permanent credentials. You use them only once in a while to prove your identity when you request a new access token.
Access Token: This is a temporary credential that you get after proving your identity. You use this token to make your actual API calls (e.g., get orders, update inventory). This method is highly secure because your permanent secret is not sent with every single request.
Token Lifespan

Access tokens are designed to be short-lived for security. Each token is valid for 24 hours (86,400 seconds).
Prerequisites

Before you can generate an access token, you must first complete the steps in the Application Management guide. This is a critical first step, as it will provide you with the Client ID and Client Secret required for authentication.
The Authentication Workflow

Follow these steps to generate and use an access token.
Step 1: Get Your Credentials Ready

Before you start, make sure you have the Client ID and Client Secret for the application you created in the Application Management portal.
Step 2: Choose the Right Environment

For any request you must use the correct audience URL based on whether you are working in the sandbox or production environment.
Sandbox : https://sandbox.api.wayfair.com/
Production : https://api.wayfair.com/
Step 3: Request Your Access Token

Using Postman or a similar API tool, send a POST request to our authentication server with your application keys in the request body.
Endpoint URL: https://sso.auth.wayfair.com/oauth/token

curl -X POST https://sso.auth.wayfair.com/oauth/token \
-H 'content-type: application/json' \
-d '{
  "grant_type": "client_credentials",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "audience": "https://sandbox.api.wayfair.com/"
}'

A successful request will return a response containing your new access token.
Step 4: Use the Access Token

In all of your subsequent API calls, you must include the token in the Authorization header. Make sure to prefix the token with Bearer followed by a space.
Header Format: Authorization: Bearer YOUR_ACCESS_TOKEN

Best Practices for Token Management

Proactive Renewal

To ensure your integration runs smoothly without interruption, we recommend you request a new token every 12 hours. This provides a safe buffer and prevents issues related to token expiration.
Security First

Treat your keys and tokens like passwords.
DO NOT hardcode them in your code.
DO NOT share them in version control (like GitHub) or in publicly shared Postman collections.
DO store your keys securely using environment variables or a secrets management service.