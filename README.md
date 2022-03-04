# Pre-Draft Mailer

A cloudflare workers that sends an email to the Teledisko Founders every time there is a new resolution pre-draft created on chain.
This way they can have a look and either update, approve or reject them.

## Components

* [Cloudflare worker](https://workers.cloudflare.com/)
* [Zoho Email APIs](https://api-console.zoho.com/)
* [The Graph](https://thegraph.com/hosted-service/subgraph/telediskodao/resolution)
* [Uptime Robot](https://uptimerobot.com)

### Overall architecture
The cloudflare worker orchestrates the logic of the mailer. More in details:

* It checks whether there are new resolutions on The Graph
* If so, authenticates to Zoho and and sends out an email per each new resolution

It is run every 5 minutes from a Scheduled Trigger inside Cloudflare.

In case of failures on any of these steps, the worker will anyway shut down successfully, but it will store the outcome of its operations in the KV.
There are then 3 endpoints in charge of returning the status of each of the external dependencies based on these KV values:

* `/health/email`: returns 500 when 1 or more emails have not been sent due to errors
* `/health/graph`: returns 500 when the last time the worker ran, the response from The Graph was erroneous
* `/health/auth`: returns 500 when the last the worker tried to authenticate to Zoho, no access token was returned

Whenever any of these endpoints turn red, an email will be sent by the Uptime Robot to the maintainer emails.

### Troubleshooting

Whenever an alert comes, check which endpoint failed. This will tell which of the dependencies caused the issue.
Possible problems:
* Connection to any of the dependencies fail: this will result in a 500 or connection time out error. Check the logs for more details.
* The Graph returns an error: make sure a recent subgraph deployment did no break the query interface and the endpoint.
* Email returns an error: some emails were not sent. Check the logs for more details. If it's a temporary error, the failed emails will be sent during the next run, so you can try to wait half an hour and if the error is not gone, investigate further.
* Auth: the access token request to Zoho failed. This usually requires to re-execute the Oauth sequence manually to get a new refresh token. Example:
```
curl "https://accounts.zoho.com/oauth/v2/token" -XPOST -d "client_id=<client id>&client_secret=<client secret>&code=<temporary code>&grant_type=authorization_code" -H 'Content-Type: application/x-www-form-urlencoded'

# Take authorization code refresh code from the response and update refresh token in secrets
wrangler secret put ZOHO_REFRESH_TOKEN

# Then input the new refresh token
```

You can find these information (client id, client secret and temporary code) at https://api-console.zoho.com/, in the Self Client section.
#### How to check the logs
* Login to https://workers.cloudflare.com/
* Go to the worker page
![Alt text](docs/overview.png?raw=true "Title")
* Click "Begin Log Stream"
* Trigger the worker by visiting its URL
* Check the errors

Alternatively to the first 3 steps, you can simply locally run
```
wrangler tail
```

## Note: You must use [wrangler](https://developers.cloudflare.com/workers/cli-wrangler/install-update) 1.17 or newer to use this template.

# Development

## Local
Start a local dev server with `minflare`
```
npx miniflare --watch --debug --kv MAIN_NAMESPACE
```

You need an environment named `.env.test` with a minimum set of variable defined in order to start. Check the `.env.test.sample` for more details.

You should then be able to invoke the worker on localhost at the address that miniflare will output.

## Deploy

```
wrangler publish
```

