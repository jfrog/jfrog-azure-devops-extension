// Based on toolLib.downloadTool:
const fs = require('fs-extra');
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const httpm = require("typed-rest-client/HttpClient");
const uuidV4 = require('uuid/v4');

module.exports = {
    downloadTool: downloadTool
};

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

function _getAgentTemp() {
    tl.assertAgent('2.115.0');
    let tempDirectory = tl.getVariable('Agent.TempDirectory');
    if (!tempDirectory) {
        throw new Error('Agent.TempDirectory is not set');
    }
    return tempDirectory;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadTool(url, fileName, handlers) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                let pkg = require(path.join(__dirname, 'package.json'));
                let userAgent = 'vsts-task-installer/' + pkg.version;
                let requestOptions = {
                    // ignoreSslError: true,
                    proxy: tl.getHttpProxyConfiguration(),
                    cert: tl.getHttpCertConfiguration()
                };
                let http = new httpm.HttpClient(userAgent, handlers, requestOptions);
                tl.debug(fileName);
                fileName = fileName || uuidV4();
                // check if it's an absolute path already
                var destPath;
                if (path.isAbsolute(fileName)) {
                    destPath = fileName;
                }
                else {
                    destPath = path.join(_getAgentTemp(), fileName);
                }
                // make sure that the folder exists
                tl.mkdirP(path.dirname(destPath));
                console.log(tl.loc('TOOL_LIB_Downloading', url));
                tl.debug('destination ' + destPath);
                if (fs.existsSync(destPath)) {
                    throw new Error("Destination file path already exists");
                }
                tl.debug('downloading');
                const statusCodesToRetry = [httpm.HttpCodes.BadGateway, httpm.HttpCodes.ServiceUnavailable, httpm.HttpCodes.GatewayTimeout];
                let retryCount = 1;
                const maxRetries = 3;
                let response = yield http.get(url);
                while (retryCount < maxRetries && statusCodesToRetry.indexOf(response.message.statusCode) > -1) {
                    tl.debug(`Download attempt "${retryCount}" of "${maxRetries}" failed with status code "${response.message.statusCode}".`);
                    retryCount += 1;
                    yield delay(1000);
                    tl.debug(`Downloading attempt "${retryCount}" of "${maxRetries}"`);
                    response = yield http.get(url);
                }
                if (response.message.statusCode !== 200) {
                    let err = new Error('Unexpected HTTP response: ' + response.message.statusCode);
                    err['httpStatusCode'] = response.message.statusCode;
                    tl.debug(`Failed to download "${fileName}" from "${url}". Code(${response.message.statusCode}) Message(${response.message.statusMessage})`);
                    throw err;
                }
                tl.debug('creating stream');
                let file = fs.createWriteStream(destPath);
                file.on('open', (fd) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        let stream = response.message.pipe(file);
                        stream.on('close', () => {
                            tl.debug('download complete');
                            resolve(destPath);
                        });
                    }
                    catch (err) {
                        reject(err);
                    }
                }));
                file.on('error', (err) => {
                    file.end();
                    reject(err);
                });
            }
            catch (error) {
                reject(error);
            }
        }));
    });
}