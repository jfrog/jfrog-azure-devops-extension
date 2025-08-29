const tl = require('azure-pipelines-task-lib/task');
const utils = require('@jfrog/tasks-utils/utils.js');

const cliGradleCommand = 'gradle';
const gradleConfigCommand = 'gradlec';
let serverIdDeployer;
let serverIdResolver;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath) {
    utils.setJdkHomeForJavaTasks();
    let workDir = getWorkDir();
    try {
        if (!workDir) {
            tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
            return;
        }
        executeGradleConfig(cliPath, workDir);

        // Check Gradle version
        let isGradle9OrAbove = false;
        const gradleVersion = getGradleVersion(cliPath, workDir);

        if (gradleVersion) {
            // Parse major version number
            const versionParts = gradleVersion.split('.');
            const majorVersion = parseInt(versionParts[0], 10);

            if (!isNaN(majorVersion) && majorVersion >= 9) {
                isGradle9OrAbove = true;
                console.log(`Gradle ${majorVersion} detected - using Gradle 9+ compatible mode`);
            } else {
                console.log(`Gradle ${majorVersion} detected - using standard mode`);
            }
        } else {
            console.log('Could not determine Gradle version - using standard mode');
        }

        executeGradle(cliPath, workDir, isGradle9OrAbove);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        return;
    } finally {
        cleanup(cliPath, workDir);
    }

    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

/**
 * Get working directory from input. If missing, return the default working directory.
 * @returns {string}
 */
function getWorkDir() {
    let workDir = tl.getInput('workDir');
    if (!workDir) {
        workDir = tl.getVariable('System.DefaultWorkingDirectory');
    }
    return workDir;
}

/**
 * Run 'jf gradle-config'.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Gradle project directory
 */
function executeGradleConfig(cliPath, workDir) {
    // Build the cli config command.
    let cliCommand = utils.cliJoin(cliPath, gradleConfigCommand);

    // Configure resolver server, throws on failure.
    let artifactoryResolver = tl.getInput('artifactoryResolverService');
    if (artifactoryResolver) {
        serverIdResolver = utils.assembleUniqueServerId('gradle_resolver');
        utils.configureArtifactoryCliServer(artifactoryResolver, serverIdResolver, cliPath, workDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolver));
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, throws on failure.
    let artifactoryDeployer = tl.getInput('artifactoryDeployerService');
    if (artifactoryDeployer) {
        serverIdDeployer = utils.assembleUniqueServerId('gradle_deployer');
        utils.configureArtifactoryCliServer(artifactoryDeployer, serverIdDeployer, cliPath, workDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-deploy=' + utils.quote(serverIdDeployer));
    }

    // Add common Gradle config parameters.
    cliCommand = utils.addStringParam(cliCommand, 'sourceRepo', 'repo-resolve');
    cliCommand = utils.addStringParam(cliCommand, 'targetRepo', 'repo-deploy');
    cliCommand = utils.addBoolParam(cliCommand, 'usesPlugin', 'uses-plugin');
    cliCommand = utils.addBoolParam(cliCommand, 'useWrapper', 'use-wrapper');
    cliCommand = utils.addBoolParam(cliCommand, 'deployMavenDesc', 'deploy-maven-desc');
    cliCommand = utils.addBoolParam(cliCommand, 'deployIvyDesc', 'deploy-ivy-desc');
    cliCommand = utils.addStringParam(cliCommand, 'ivyDescPattern', 'ivy-desc-pattern');
    cliCommand = utils.addStringParam(cliCommand, 'ivyArtifactsPattern', 'ivy-artifacts-pattern');

    // Execute cli.
    utils.executeCliCommand(cliCommand, workDir);
}

/**
 * Get Gradle version from the project.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Gradle project directory
 * @returns {string}
 */
function getGradleVersion(cliPath, workDir) {
    try {
        // Use JFrog CLI to get gradle version, which will handle wrapper logic internally
        // based on the gradle configuration
        const gradleCommand = utils.cliJoin(cliPath, cliGradleCommand, '--version');

        // Execute gradle --version through JFrog CLI and capture output
        const gradleVersionOutput = utils.executeCliCommand(gradleCommand, workDir, { withOutput: true }).toString();

        // Parse version from output using regex (works cross-platform)
        // Looking for pattern like "Gradle 9.0.1" or "Gradle 8.5"
        const versionMatch = gradleVersionOutput.match(/Gradle\s+(\d+\.\d+(?:\.\d+)?)/);

        if (versionMatch && versionMatch[1]) {
            const version = versionMatch[1];
            console.log(`Detected Gradle version: ${version}`);
            return version;
        } else {
            console.log('Could not parse Gradle version from output:');
            console.log(gradleVersionOutput);
            return '';
        }
    } catch (error) {
        console.log(`Error getting Gradle version: ${error.message}`);
        return '';
    }
}

/**
 * Run 'jf gradle'.
 * @param cliPath - Path to JFrog CLI
 * @param workDir - Gradle project directory
 * @param isGradle9 - Whether Gradle version 9 or higher is being used
 */
function executeGradle(cliPath, workDir, isGradle9) {
    let tasksAndOptions = tl.getInput('tasks');
    let options = tl.getInput('options');
    if (options) {
        tasksAndOptions = utils.cliJoin(tasksAndOptions, options);
    }
    // Gradle 9+ changed how build files are specified, so we don't use the -b flag
    // for version 9 and above to avoid compatibility issues
    if (!isGradle9) {
        tasksAndOptions = utils.cliJoin(tasksAndOptions, '-b', tl.getInput('gradleBuildFile'));
    }
    let gradleCommand = utils.cliJoin(cliPath, cliGradleCommand, tasksAndOptions);
    gradleCommand = utils.appendBuildFlagsToCliCommand(gradleCommand);

    // Execute cli.
    utils.executeCliCommand(gradleCommand, workDir);
}

function cleanup(cliPath, workDir) {
    // Delete servers.
    utils.taskDefaultCleanup(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    // Remove extractor variables.
    try {
        utils.removeExtractorsDownloadVariables(cliPath, workDir);
    } catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException);
    }
}
