# Client Setup – Treez Sync

## Prerequisites

1. **Node.js** – Install from https://nodejs.org/ (LTS version)
2. **Project folder** – Copy the entire project to the client's PC
3. **Same network** – PC must be on the same network as the EBS50 (ebs50.local)

## One-time setup

1. Create `.env.local` in the project folder with:

```
# Treez API
TREEZ_API_KEY=<your-key>
TREEZ_DISPENSARY=<dispensary-id>
TREEZ_API_URL=https://api.treez.io/v2.0/dispensary
TREEZ_CLIENT_ID=<client-id>

# Opticon EBS50 (store local)
EBS50_BASE_URL=https://ebs50.local
EBS50_API_KEY=<your-ebs50-api-key>
EBS50_INSECURE=true
```

2. Save the file.

## Run the app

**Double-click `start-app.bat`**

Or from terminal:
```
start-app.bat
```

The app will open at **http://localhost:3000**. Open this in a browser.

## Access from other devices

From another PC/tablet on the same network: `http://<this-PC-IP>:3000`  
(e.g. `http://192.168.1.50:3000`)
