# Stool Tracker Daily Log App
        
I want to build an android app. It needs to be offline. It is basically a "to do app" with a twist. It keeps track of what kind of stool you had that day. and how many times. The stool type is rated on a scale from 0 to 7 to measure how constipated you are(0 no activity, 1-7 bristol scale). It has to have an calendar. When you press a day it opens new window . In this window you can create, update or delete an entry. Import/export option to csv/json file. Before starting wait for an example of interface view


Made with Floot.

# Instructions

For security reasons, the `env.json` file is not pre-populated — you will need to generate or retrieve the values yourself.  

For **JWT secrets**, generate a value with:  

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then paste the generated value into the appropriate field.  

For the **Floot Database**, request a `pg_dump` from support, upload it to your own PostgreSQL database, and then fill in the connection string value.  

**Note:** Floot OAuth will not work in self-hosted environments.  

For other external services, retrieve your API keys and fill in the corresponding values.  

Once everything is configured, you can build and start the service with:  

```
npm install -g pnpm
pnpm install
pnpm vite build
pnpm tsx server.ts
```
