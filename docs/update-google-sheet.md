# Update Google Sheet

## Authentication

This command is intended to be run from a Google Cloud Run Job. It therefore currently uses [Google's Application 
Default Configuration authentication mechanism](https://cloud.google.com/docs/authentication/client-libraries#node.js_1).

### User credentials

You will need to [set up Application Default Credentials for your local development environment](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment#local-user-cred),
to be able to run this command.

### Service Account Credentials

When running as a Cloud Run Job, the Application Default Credentials should be for a dedicated service account. To test
with the Service Account, you can set up Service Account Impersonation.

1. Create the service account
2. Grant yourself the "Service Account Token Creator" on the Service Account or GCP Project you are using
3. Grant the Service Account Editor permissions on the Google Sheet you want to update
4. Set the Application Default Credential to impersonate the Service Account created above. See 
   https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment#sa-impersonation