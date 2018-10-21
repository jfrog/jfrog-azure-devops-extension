const tl = require('vsts-task-lib/task');
const stringUtils = require('./stringUtils');

class CliCommandBuilder {

    constructor(cliPath) {
        this.command = cliPath
    }

    /**
     * Adds the provided command with leading space to the builder. Wraps every part of the command with quotes.
     * For example the command 'rt c' will be added as ' "rt" "c"'.
     *
     * @param cliCommand the command to add
     * @returns {CliCommandBuilder} the updated builder
     */
    addCommand(cliCommand) {
        let commandAsArray = cliCommand.split(" ");
        for (let i = 0; i < commandAsArray.length; ++i) {
            this.addArguments(commandAsArray[i]);
        }
        return this;
    }

    /**
     * Adds to the command the flags "url", "user" and "password" according the configured in task artifactoryService endpoint parameter.
     * If no username is associated with the artifactoryService, the username will be "anonymous" and no password will be set.
     *
     * @param artifactoryServiceParam the endpoint parameter
     * @returns {CliCommandBuilder} the updated builder
     */
    addArtifactoryServerWithCredentials(artifactoryServiceParam) {
        let artifactoryService = tl.getInput(artifactoryServiceParam, false);
        let url = tl.getEndpointUrl(artifactoryService, false);
        let artifactoryUser = tl.getEndpointAuthorizationParameter(artifactoryService, "username", true);
        let artifactoryPassword = tl.getEndpointAuthorizationParameter(artifactoryService, "password", true);

        this.addOption("url", url);
        // Check if should make anonymous access to artifactory
        if (artifactoryUser === "") {
            return this.addOption("user", "anonymous");
        }
        return this.addOption("user", artifactoryUser).addOption("password", artifactoryPassword);
    }

    /**
     * Adds the provided arguments to the builder with leading space. Wraps every argument with quotes.
     * For example the command addArguments('rt c', 'yo') will add to the command the following string ' "rt c" "yo"'.
     *
     * @param arguments the arguments to be added
     * @returns {CliCommandBuilder} the updated builder
     */
    addArguments() {
        for (let i = 0; i < arguments.length; ++i) {
            let arg = arguments[i];
            if (arg.length > 0) {
                this.command += " " + stringUtils.quote(arg);
            }
        }
        return this;
    }

    /**
     * Adds to the command a string option according the task input.
     * If the inputParam and the cliOption are equals only one argument can be used.
     *
     * For example:
     * task input: {foo:"bar", envVars:"yo"}
     * addStringOptionFromParam("envVars", "env-vars") will add the following string to the command: ' --env-vars="yo"'.
     * addStringOptionFromParam("foo") will add the following string to the command: ' --foo="bar"'.
     *
     * @param inputParam - The task parameter name
     * @param cliOption - Optional. The cli option to be added. If not provided the inputParam will be used as the option
     * @returns {CliCommandBuilder} the updated builder
     */
    addStringOptionFromParam(inputParam, cliOption) {
        let val = tl.getInput(inputParam, false);
        if (val === null) {
            return this;
        }
        if (!cliOption) {
            cliOption = inputParam
        }
        return this.addOption(cliOption, val);
    }

    /**
     * Adds to the command a boolean option according the task input.
     * If the inputParam and the cliOption are equals only one argument can be used.
     *
     * For example:
     * task input: {foo:true, envVars:false}
     * addStringOptionFromParam("envVars", "env-vars") will add the following string to the command: ' --env-vars="false"'.
     * addStringOptionFromParam("foo") will add the following string to the command: ' --foo="true"'.
     *
     * @param inputParam - The task parameter name
     * @param cliOption - Optional. The cli option to be added. If not provided the inputParam will be used as the option
     * @returns {CliCommandBuilder} the updated builder
     */
    addBoolOptionFromParam(inputParam, cliOption) {
        let val = tl.getBoolInput(inputParam, false);
        if (!cliOption) {
            cliOption = inputParam
        }
        return this.addOption(cliOption, val);
    }

    /**
     * Adds the options "build-name" and "build-number" if collectBuildInfo task param is configured to true.
     *
     * @returns {CliCommandBuilder} the updated builder.
     */
    addBuildFlagsIfRequired() {
        if (tl.getBoolInput("collectBuildInfo")) {
            return this.addOption("build-name", getBuildName())
                .addOption("build-number", getBuildNumber());
        }
        return this;
    }

    /**
     * Adds to the command an option according the provided input.
     * For example addOption("foo", "b a r") will add the string ' --foo="b a r"' to the command
     *
     * @param option - The key of the option.
     * @param value - The value to set.
     * @returns {CliCommandBuilder} the updated builder.
     */
    addOption(option, value) {
        this.command += " --" + option + "=" + stringUtils.quote(value);
        return this
    }

    /**
     * Returns the final command as String.
     *
     * @returns {String} - A string that represent a cli command.
     */
    build() {
        return this.command;
    }
}

/**
 * Returns the build name. In case of release, the param "Release.DefinitionName" will be used, "Build.DefinitionName" will be used otherwise.
 *
 * @returns {String} - The build name of the task. In case of release, the param "Release.DefinitionName" will be used, "Build.DefinitionName" will be used otherwise.
 */
function getBuildName() {
    let bn = tl.getVariable('Release.DefinitionName');
    if (bn) {
        return bn;
    }
    return tl.getVariable('Build.DefinitionName')
}

/**
 * Returns the build number of the task. In case of release, the param "Release.DeploymentID" will be used, "Build.BuildNumber" will be used otherwise.
 *
 * @returns {String} - The build number of the task. In case of release, the param "Release.DeploymentID" will be used, "Build.BuildNumber" will be used otherwise.
 */
function getBuildNumber() {
    let bn = tl.getVariable('Release.DeploymentID');
    if (bn) {
        return bn;
    }
    return tl.getVariable('Build.BuildNumber')
}

module.exports = {
    CliCommandBuilder,
    getBuildName,
    getBuildNumber
};