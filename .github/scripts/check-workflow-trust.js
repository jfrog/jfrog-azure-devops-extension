/* eslint-env node */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const privileged = ['tests', 'cloudTests', 'e2e-plugin-tests', 'frogbot', 'release', 'staging'];
for (const name of privileged) {
    const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../workflows', name + '.yml'), 'utf8'));
    assert.ok(!workflow.on.pull_request_target && !workflow.on.pull_request, name + ' must not run PR code with secrets');
    if (workflow.on.push) {
        assert.ok(workflow.on.push.branches.length > 0);
        assert.ok(
            workflow.on.push.branches.every((branch) => ['dev', 'v2'].includes(branch)),
            name + ' needs trusted push refs',
        );
    }
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
        if (!job.needs) {
            assert.match(job.if, /github\.repository == 'jfrog\/jfrog-azure-devops-extension'/, name + '/' + jobName);
            assert.match(job.if, /github\.ref/, name + '/' + jobName + ' must guard manual dispatch refs');
        }
        for (const step of job.steps || []) {
            if (step.uses && !step.uses.startsWith('./')) {
                assert.match(step.uses, /@[a-f0-9]{40}$/, name + ' needs immutable Actions');
            }
            assert.ok(!JSON.stringify(step).includes('pull_request.head'), name + ' must not check out PR heads');
        }
    }
}
const analysis = yaml.load(fs.readFileSync(path.join(__dirname, '../workflows/analysis.yml'), 'utf8'));
assert.ok(Object.prototype.hasOwnProperty.call(analysis.on, 'pull_request'), 'PR compilation must remain available');
assert.deepEqual(analysis.permissions, { contents: 'read' });
assert.ok(!JSON.stringify(analysis).includes('secrets.'), 'PR compilation must not receive secrets');
console.log('Workflow trust boundary checks passed.');
