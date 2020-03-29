module.exports = {
    basicAuthHandler: basicAuthHandler,
    accessTokenHandler: accessTokenHandler
};

/**
 * Create HTTP request handler with username and password.
 * @param username - The username
 * @param password - The password
 * @returns {CredentialHandler}
 */
function basicAuthHandler(username, password) {
    let credentialHandler = new CredentialHandler();
    credentialHandler.username = username;
    credentialHandler.password = password;
    return credentialHandler;
}

/**
 * Create HTTP request handler with access token.
 * @param accessToken - Artifactory access token
 * @returns {CredentialHandler}
 */
function accessTokenHandler(accessToken) {
    let credentialHandler = new CredentialHandler();
    credentialHandler.accessToken = accessToken;
    return credentialHandler;
}

/**
 * @implements IRequestHandler https://github.com/microsoft/typed-rest-client/blob/1.5.0/lib/Interfaces.ts#L27
 */
class CredentialHandler {
    constructor() {
        this.artifactoryHost = '';
    }

    /**
     * Set headers.
     * @param options - HTTP request header
     */
    prepareRequest(options) {
        // Set credentials only in 2 scenarios:
        // 1. First HTTP request - The first request is always to Artifactory
        // 2. Requests to Artifactory host as set in the first request of this handler
        if (!this.artifactoryHost || this.artifactoryHost === options.host) {
            let accessToken = this.accessToken;
            if (!accessToken) {
                accessToken = new Buffer(this.username + ':' + this.password).toString('base64');
            }
            options.headers['Authorization'] = 'Basic ' + accessToken;
            this.artifactoryHost = options.host;
        }
        // To be consisted with the BasicCredentialHandler: https://github.com/microsoft/typed-rest-client/blob/1.5.0/lib/handlers/basiccreds.ts#L19
        options.headers['X-TFS-FedAuthRedirect'] = 'Suppress';
    }

    // noinspection JSUnusedLocalSymbols
    canHandleAuthentication(response) {
        return false;
    }

    // noinspection JSUnusedLocalSymbols
    handleAuthentication(httpClient, requestInfo, objs) {
        return null;
    }
}
