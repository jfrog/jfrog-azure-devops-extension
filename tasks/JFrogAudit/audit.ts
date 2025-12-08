import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as os from 'os';

const cliAuditCommand: string = 'audit';
let serverId: string;

/**
 * Publishes JFrog logs as a pipeline artifact for debugging purposes.
 * Useful for accessing JAS scanner logs (analyzerManagerLogs, etc.)
 */
function publishJFrogLogs(): void {
    try {
        const publishLogs: boolean = tl.getBoolInput('publishLogs', false);
        if (!publishLogs) {
            return;
        }
        const jfrogHome: string = process.env.JFROG_CLI_HOME_DIR || path.join(os.homedir(), '.jfrog');
        const logsPath: string = path.join(jfrogHome, 'logs');
        if (tl.exist(logsPath)) {
            // Create unique artifact name using BuildId and JobAttempt
            const buildId: string = tl.getVariable('Build.BuildId') || 'unknown';
            const jobAttempt: string = tl.getVariable('System.JobAttempt') || '1';
            const artifactName: string = `jfrog-audit-logs-${buildId}-${jobAttempt}`;
            tl.debug(`Publishing JFrog logs from: ${logsPath}`);
            tl.command('artifact.upload', { containerfolder: 'jfrog-audit-logs', artifactname: artifactName }, logsPath);
        } else {
            tl.warning(`JFrog logs directory not found at: ${logsPath}`);
        }
    } catch (err) {
        tl.warning(`Failed to publish JFrog logs: ${err}`);
    }
}

function RunTaskCbk(cliPath: string): void {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) ?? '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') ?? process.cwd();
    const sourcePath: string = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);

    serverId = utils.configureDefaultXrayServer('xray_audit', cliPath, sourcePath);

    let auditCommand: string = utils.cliJoin(cliPath, cliAuditCommand);
    auditCommand = utils.addServerIdOption(auditCommand, serverId);
    auditCommand = utils.addBoolParam(auditCommand, 'allowFailBuild', 'fail');

    // Add watches source if provided.
    const watchesSource: string = tl.getInput('watchesSource', false) ?? '';
    switch (watchesSource) {
        // Having a dash (-) in a param name in a visible rule is failing verification on Azure Server (TFS).
        // For that reason we do not use a dash in repo-path, and handle this param separately (not passing the option blindly to the CLI).
        case 'repoPath':
            auditCommand = utils.addStringParam(auditCommand, 'repoPath', 'repo-path', true);
            break;
        case 'watches':
        case 'project':
            auditCommand = utils.addStringParam(auditCommand, watchesSource, watchesSource, true);
            break;
        case 'none':
            auditCommand = utils.addBoolParam(auditCommand, 'licenses', 'licenses');
            break;
    }
    executeCliCommand(auditCommand, sourcePath, cliPath);
}

function executeCliCommand(cliCmd: string, buildDir: string, cliPath: string): void {
    try {
        utils.executeCliCommand(cliCmd, buildDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        publishJFrogLogs();
        utils.taskDefaultCleanup(cliPath, buildDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
