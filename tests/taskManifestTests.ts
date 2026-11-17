/// <reference types="mocha" />
import * as assert from 'assert';
import * as fs from 'fs';
import { join } from 'path';

/**
 * Validates the `execution` block (and related fields) of every tasks/<task>/task.json.
 *
 * These tests do not require Artifactory or an Azure DevOps agent, so they run anywhere `npm t` runs.
 * Azure Pipelines selects the highest handler that exists on the agent, so the contract we enforce is:
 *  - Node24 is declared (preferred handler).
 *  - Node20_1 is declared as a temporary fallback for agents that do not ship Node24 yet.
 *  - End-of-life handlers (Node, Node6, Node10, Node16) are not declared.
 *  - minimumAgentVersion guarantees the agent has at least the Node20_1 handler.
 */

// __dirname is not available when Node loads this file as an ES module (Node 22+), so resolve relative to the working directory:
// `npm t` runs from the tests directory, but running from the repository root works too.
const TASKS_DIR: string = [join(process.cwd(), '..', 'tasks'), join(process.cwd(), 'tasks')].filter((dir: string): boolean =>
    fs.existsSync(join(dir, 'JFrogMaven', 'task.json')),
)[0];
if (!TASKS_DIR) {
    throw new Error(
        'Could not find the tasks directory relative to ' + process.cwd() + '. Run the tests from the tests/ or repository root directory.',
    );
}
const PREFERRED_HANDLER: string = 'Node24';
const FALLBACK_HANDLER: string = 'Node20_1';
const DEPRECATED_HANDLERS: string[] = ['Node', 'Node6', 'Node10', 'Node16'];
// First Azure Pipelines agent version that ships the Node20_1 handler.
const MIN_AGENT_VERSION: string = '4.248.0';

interface TaskManifest {
    name: string;
    minimumAgentVersion: string;
    execution: { [handler: string]: { target: string; [key: string]: string } };
}

interface TaskEntry {
    dir: string;
    manifest: TaskManifest;
}

function loadManifests(): TaskEntry[] {
    return fs
        .readdirSync(TASKS_DIR)
        .filter((dir: string): boolean => fs.existsSync(join(TASKS_DIR, dir, 'task.json')))
        .sort()
        .map((dir: string) => ({
            dir,
            manifest: JSON.parse(fs.readFileSync(join(TASKS_DIR, dir, 'task.json'), 'utf8')) as TaskManifest,
        }));
}

/**
 * Compare two dotted numeric versions. Returns a negative number if a < b, 0 if equal, positive if a > b.
 */
function compareVersions(a: string, b: string): number {
    const pa: number[] = a.split('.').map(Number);
    const pb: number[] = b.split('.').map(Number);
    for (let i: number = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff: number = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

describe('Task manifest (task.json) Node handlers', (): void => {
    const tasks: TaskEntry[] = loadManifests();

    it('discovers the task manifests', (): void => {
        assert.ok(tasks.length > 0, 'No tasks/*/task.json files were found under ' + TASKS_DIR);
    });

    tasks.forEach(({ dir, manifest }: TaskEntry): void => {
        describe(dir, (): void => {
            it('declares the ' + PREFERRED_HANDLER + ' handler', (): void => {
                assert.ok(manifest.execution[PREFERRED_HANDLER], dir + '/task.json is missing the ' + PREFERRED_HANDLER + ' handler');
            });

            it('keeps the ' + FALLBACK_HANDLER + ' handler as a fallback for older agents', (): void => {
                assert.ok(manifest.execution[FALLBACK_HANDLER], dir + '/task.json is missing the ' + FALLBACK_HANDLER + ' handler');
            });

            it('does not declare end-of-life handlers', (): void => {
                const declared: string[] = Object.keys(manifest.execution);
                const found: string[] = declared.filter((handler: string): boolean => DEPRECATED_HANDLERS.indexOf(handler) !== -1);
                assert.deepStrictEqual(found, [], dir + '/task.json declares end-of-life handlers: ' + found.join(', '));
            });

            it('uses the same configuration for ' + PREFERRED_HANDLER + ' and ' + FALLBACK_HANDLER, (): void => {
                assert.deepStrictEqual(manifest.execution[PREFERRED_HANDLER], manifest.execution[FALLBACK_HANDLER]);
            });

            it('points to an entry point that exists (.js, or the .ts it is compiled from)', (): void => {
                Object.keys(manifest.execution).forEach((handler: string): void => {
                    const target: string = manifest.execution[handler].target;
                    assert.ok(target.endsWith('.js'), handler + ' target should be a .js file: ' + target);
                    const js: string = join(TASKS_DIR, dir, target);
                    const ts: string = js.replace(/\.js$/, '.ts');
                    assert.ok(fs.existsSync(js) || fs.existsSync(ts), handler + ' target ' + target + ' has no .js or .ts file in ' + dir);
                });
            });

            it('requires an agent version that ships the ' + FALLBACK_HANDLER + ' handler (>= ' + MIN_AGENT_VERSION + ')', (): void => {
                assert.ok(
                    compareVersions(manifest.minimumAgentVersion, MIN_AGENT_VERSION) >= 0,
                    dir + '/task.json minimumAgentVersion is ' + manifest.minimumAgentVersion + ', expected >= ' + MIN_AGENT_VERSION,
                );
            });
        });
    });

    it('declares the same set of handlers in all tasks', (): void => {
        const signatures: { [signature: string]: string[] } = {};
        tasks.forEach(({ dir, manifest }: TaskEntry): void => {
            const signature: string = Object.keys(manifest.execution).sort().join(',');
            (signatures[signature] = signatures[signature] || []).push(dir);
        });
        assert.strictEqual(Object.keys(signatures).length, 1, 'Tasks declare different handler sets: ' + JSON.stringify(signatures));
    });
});
