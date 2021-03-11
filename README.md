# Sample app for mmg-graph
This is a sample app built using aws serverless framework that uses MMG graph APIs through the [Nodejs SDK](https://github.com/MMGFusion/mmg-graph).

This app provides and admin dashboard to show a list of leads for all businesses who have installed this app with the ability to download the audio files of each call.

Here are the requirements for to try this app:

1. Register for a developer's account with [MMG-Fusion](https://www.mmgfusion.com)
2. Create an app and obtain the app API key and secret
3. Clone this repo and either replace the API key and secret as environment variables or change it in index.js
4. Install on serverless directly or deploy it locally:
```bash
npm install
sls dynamodb install
sls offline start
```
5. Enter the url of your serverless url (local or cloud) as the admin dashboard url in your MMG account.
6. Click on your dashboard's app link in MMG portal to see your app running.

You can also see other examples in the examples folder.

