const fs = require('fs');
const path = require('path');
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const editJsonFile = require('edit-json-file');
const compareVersions = require('compare-versions');
const editJsonFileOptions = {autosave: true, stringify_width: 4};
const optionDefinitions = [
    {name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide'},
    {name: 'version', alias: 'v', type: String, description: 'Version to set. Must be bigger than the current version. Format: X.X.X'}
];
const usage = commandLineUsage([
    {
        header: 'Bump version of JFrog Artifactory VSTS extension',
        content: 'Tool to Bump version of JFrog Artifactory VSTS extension. It bumps version in all task.json files and in vss-extension.json.'
    },
    {
        header: 'Options',
        optionList: optionDefinitions
    }
]);
const commandLineArgsOptions = commandLineArgs(optionDefinitions, {camelCase: true});
if (commandLineArgsOptions.help || !commandLineArgsOptions.version) {
    console.log(usage);
    process.exit(commandLineArgsOptions.help ? 0 : 1);
}
const splitVersion = commandLineArgsOptions.version.split('.');

assertVersion();
updateTasks();
updateVssExtension();

/**
 * Assert new version above the current version.
 */
function assertVersion() {
    assert.equal(splitVersion.length, 3, 'Version must be of format X.X.X');
    let vssExtension = fs.readFileSync('vss-extension.json', 'utf8');
    let vssExtensionJson = JSON.parse(vssExtension);
    assert.equal(compareVersions(commandLineArgsOptions.version, vssExtensionJson.version), 1, 'Input version must be bigger than current version');
}

/**
 * Update versions of all tasks.
 */
function updateTasks() {
    let files = fs.readdirSync(path.join('tasks'));
    files.forEach(taskName => {
        console.log('Updating ' + taskName);
        let taskDir = path.join('tasks', taskName);
        let taskJsonPath = path.join(taskDir, 'task.json');
        let taskJson = editJsonFile(taskJsonPath, editJsonFileOptions);
        taskJson.set('version', {
            'Major': splitVersion[0],
            'Minor': splitVersion[1],
            'Patch': splitVersion[2]
        });
    });
}

/**
 * Update version of vss-extension.json.
 */
function updateVssExtension() {
    console.log('Updating vss-extension.json');
    let vssExtensionJson = editJsonFile('vss-extension.json', editJsonFileOptions);
    vssExtensionJson.set('version', commandLineArgsOptions.version);
}