import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliAuditCommand: string = 'audit';
let serverId: string;

function RunTaskCbk(cliPath: string): void {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) || '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    const sourcePath: string = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);

    serverId = utils.configureDefaultXrayServer('xray_audit', cliPath, sourcePath);

    let auditCommand: string = utils.cliJoin(cliPath, cliAuditCommand);
    auditCommand = utils.addServerIdOption(auditCommand, serverId);
    auditCommand = utils.addBoolParam(auditCommand, 'allowFailBuild', 'fail');

    // Add watches source if provided.
    const watchesSource: string = tl.getInput('watchesSource', false) || '';
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
        utils.taskDefaultCleanup(cliPath, buildDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);
