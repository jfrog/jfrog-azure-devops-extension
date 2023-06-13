/// <reference types="./node_modules/node-tunnel/typings/basic-auth-parser" />
import * as adoMockTest from 'azure-pipelines-task-lib/mock-test';
import * as fs from 'fs-extra';
import * as jfrogUtils from '@jfrog/tasks-utils';
import * as mocha from 'mocha';
import * as path from 'path';
import * as syncRequest from 'sync-request';
import * as TestUtils from './testUtils';
import { platformDockerDomain } from './testUtils';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as assert from 'assert';
import * as os from 'os';
import conanUtils from '../tasks/JFrogConan/conanUtils';
import { Tunnel } from 'node-tunnel';
import { execSync } from 'child_process';

let tasksOutput: string;

describe('JFrog Artifactory Extension Tests', (): void => {
    let repoKeys: any;
    before(function(): void {
        this.timeout(120000); // 2 minutes timer for the before hook only.
        // Validate environment variables exist for tests
        assert.ok(TestUtils.platformUrl, 'Tests are missing environment variable: ADO_JFROG_PLATFORM_URL');
        if (TestUtils.platformAccessToken == '') {
            assert.ok(TestUtils.platformUsername, 'Tests are missing environment variable: ADO_JFROG_PLATFORM_USERNAME');
            assert.ok(TestUtils.platformPassword, 'Tests are missing environment variable: ADO_JFROG_PLATFORM_PASSWORD');
        }

        TestUtils.initTests();
        repoKeys = TestUtils.getRepoKeys();
    });

    beforeEach((): void => {
        tasksOutput = '';
    });

    after(function(): void {
        this.timeout(120000); // 2 minutes timer for the after hook only.
        TestUtils.cleanUpAllTests();
    });

    describe('Unit Tests', (): void => {
        console.log('OS:', os.type());
        runSyncTest(
            'Mask password',
            (): void => {
                const oldPassword: string = process.env.ADO_ARTIFACTORY_PASSWORD || '';
                process.env.ADO_ARTIFACTORY_PASSWORD = 'SUPER_SECRET';
                let retVal: string = '';
                try {
                    jfrogUtils.executeCliCommand(
                        'jf rt del ' +
                            repoKeys.repo1 +
                            '/' +
                            ' --url=' +
                            jfrogUtils.quote(process.env.ADO_PLATFORM_URL + "/artifactory" ) +
                            ' --user=' +
                            jfrogUtils.quote(process.env.ADO_PLATFORM_USERNAME || '') +
                            ' --password=' +
                            jfrogUtils.quote('SUPER_SECRET'),
                        TestUtils.testDataDir
                    );
                } catch (ex) {
                    retVal = ex as string;
                }
                assert.ok(retVal !== '', 'An exception should have been caught');
                process.env.ADO_ARTIFACTORY_PASSWORD = oldPassword;
                assert.ok(!retVal.toString().includes('SUPER_SECRET'), 'Output contains password');
            },
            TestUtils.isSkipTest('unit')
        );

        runAsyncTest(
            'Download JFrog CLI through a proxy',
            (done: mocha.Done): void => {
                process.env.HTTP_PROXY = 'http://localhost:8000';
                let cliDownloadedWithProxy: boolean = false;

                const tunnel: Tunnel = new Tunnel();
                tunnel.listen(8000);
                tunnel.use((req, cltSocket, head, next): void => {
                    // We are here for each http request.
                    cliDownloadedWithProxy = true;
                    next();
                });

                jfrogUtils
                    .downloadCli()
                    .then((): void => {
                        tunnel.close();
                        process.env.HTTP_PROXY = '';
                        done(cliDownloadedWithProxy ? '' : new Error('CLI downloaded without using the proxy server'));
                    })
                    .catch((): string => 'download with proxy failed');
            },
            TestUtils.isSkipTest('proxy')
        );

        runSyncTest(
            'Cli join',
            (): void => {
                assert.strictEqual(jfrogUtils.cliJoin('jf', 'rt', 'u'), 'jf rt u');
                assert.strictEqual(jfrogUtils.cliJoin('jf'), 'jf');
                assert.strictEqual(jfrogUtils.cliJoin('jf', 'rt', 'u', 'a/b/c', 'a/b/c'), 'jf rt u a/b/c a/b/c');
                assert.strictEqual(jfrogUtils.cliJoin('jf', 'rt', 'u', 'a\bc', 'a\bc'), 'jf rt u a\bc a\bc');
                assert.strictEqual(jfrogUtils.cliJoin('jf', 'rt', 'u', 'a\\bc\\', 'a\\bc\\'), 'jf rt u a\\bc\\ a\\bc\\');
            },
            TestUtils.isSkipTest('unit')
        );

        runSyncTest(
            'Fix windows paths',
            (): void => {
                const specBeforeFix: string = fs.readFileSync(path.join(__dirname, 'resources', 'fixWindowsPaths', 'specBeforeFix.json'), 'utf8');
                const expectedSpecAfterFix: string = fs.readFileSync(
                    path.join(__dirname, 'resources', 'fixWindowsPaths', 'specAfterFix.json'),
                    'utf8'
                );
                const specAfterFix: string = jfrogUtils.fixWindowsPaths(specBeforeFix);
                assert.strictEqual(specAfterFix, TestUtils.isWindows() ? expectedSpecAfterFix : specBeforeFix, '\nSpec after fix:\n' + specAfterFix);
            },
            TestUtils.isSkipTest('unit')
        );

        runSyncTest(
            'Encode paths',
            (): void => {
                if (TestUtils.isWindows()) {
                    assert.strictEqual(jfrogUtils.encodePath('dir1\\dir 2\\dir 3'), 'dir1\\"dir 2"\\"dir 3"');
                    assert.strictEqual(jfrogUtils.encodePath('dir 1\\dir2\\a b.txt'), '"dir 1"\\dir2\\"a b.txt"');
                    assert.strictEqual(jfrogUtils.encodePath('dir1\\dir2\\a.txt'), 'dir1\\dir2\\a.txt');
                    assert.strictEqual(jfrogUtils.encodePath('dir1\\'), 'dir1\\');
                } else {
                    assert.strictEqual(jfrogUtils.encodePath('dir1/dir 2/dir 3'), 'dir1/"dir 2"/"dir 3"');
                    assert.strictEqual(jfrogUtils.encodePath('dir 1/dir2/a b.txt'), '"dir 1"/dir2/"a b.txt"');
                    assert.strictEqual(jfrogUtils.encodePath('dir1/dir2/a.txt'), 'dir1/dir2/a.txt');
                    assert.strictEqual(jfrogUtils.encodePath('dir1/'), 'dir1/');
                    assert.strictEqual(jfrogUtils.encodePath('/dir1'), '/dir1');
                }
                assert.strictEqual(jfrogUtils.encodePath('dir 1'), '"dir 1"');
                assert.strictEqual(jfrogUtils.encodePath('dir1'), 'dir1');
                // Avoid double encoding
                assert.strictEqual(jfrogUtils.encodePath('"dir 1"'), '"dir 1"');
                assert.strictEqual(jfrogUtils.encodePath("'dir 1'"), "'dir 1'");
            },
            TestUtils.isSkipTest('unit')
        );

        runSyncTest(
            'Get architecture',
            (): void => {
                const arch: string = jfrogUtils.getArchitecture();
                switch (os.type()) {
                    case 'Linux':
                        assert.ok(arch.startsWith('linux-'));
                        break;
                    case 'Darwin':
                        assert.ok(arch.startsWith('mac-'));
                        break;
                    case 'Windows_NT':
                        assert.strictEqual(arch, 'windows-amd64');
                        break;
                    default:
                        assert.fail('Unsupported OS found: ' + os.type());
                }
            },
            TestUtils.isSkipTest('unit')
        );

        runSyncTest(
            'Utils - determine cli workdir',
            (): void => {
                if (TestUtils.isWindows()) {
                    assert.strictEqual(
                        jfrogUtils.determineCliWorkDir('C:\\myAgent\\_work\\1', 'C:\\myAgent\\_work\\1\\myFolder'),
                        'C:\\myAgent\\_work\\1\\myFolder'
                    );
                    assert.strictEqual(jfrogUtils.determineCliWorkDir('C:\\myAgent\\_work\\1', ''), 'C:\\myAgent\\_work\\1');
                    assert.strictEqual(
                        jfrogUtils.determineCliWorkDir('C:\\myAgent\\_work\\1', 'myFolder\\123'),
                        'C:\\myAgent\\_work\\1\\myFolder\\123'
                    );
                } else {
                    assert.strictEqual(
                        jfrogUtils.determineCliWorkDir('/Users/myUser/myAgent/_work/1', '/Users/myUser/myAgent/_work/1/myFolder'),
                        '/Users/myUser/myAgent/_work/1/myFolder'
                    );
                    assert.strictEqual(jfrogUtils.determineCliWorkDir('/Users/myUser/myAgent/_work/1', ''), '/Users/myUser/myAgent/_work/1');
                    assert.strictEqual(
                        jfrogUtils.determineCliWorkDir('/Users/myUser/myAgent/_work/1', 'myFolder/123'),
                        '/Users/myUser/myAgent/_work/1/myFolder/123'
                    );
                }
            },
            TestUtils.isSkipTest('unit')
        );

        runSyncTest(
            'CLI version compare',
            (): void => {
                assert.strictEqual(jfrogUtils.compareVersions('1.37.1', '1.37.1'), 0);
                assert.strictEqual(jfrogUtils.compareVersions('0.8', '1.37.1'), -1);
                assert.strictEqual(jfrogUtils.compareVersions('1', '1.37.1'), -1);
                assert.strictEqual(jfrogUtils.compareVersions('1.37.0', '1.37.1'), -1);
                assert.strictEqual(jfrogUtils.compareVersions('1.500.0', '1.37.1'), 1);
                assert.strictEqual(jfrogUtils.compareVersions('2', '1.37.1'), 1);
                assert.strictEqual(jfrogUtils.compareVersions('1.37.3', '1.37.1'), 1);
                assert.strictEqual(jfrogUtils.compareVersions('2.37.1', '1.37.1'), 1);
            },
            TestUtils.isSkipTest('unit')
        );

        /**
         * This test was created to ensure the equality of the build partials paths created by the CLI and the ones provided by
         * getCliPartialsBuildDir method.
         */
        runSyncTest(
            'Conan Utils - Get Cli Partials Build Dir',
            (): void => {
                testGetCliPartialsBuildDir();
            },
            TestUtils.isSkipTest('unit')
        );
    });

    describe('JFrog CLI Task Tests', (): void => {
        runSyncTest(
            'JFrog CLI Task Test',
            (): void => {
                const testDir: string = 'jfrogCliTask';
                // Upload a.in. b.in and c.in
                mockTask(testDir, 'upload');
                // Delete a.in
                mockTask(testDir, 'delete');
                // Rename b.in to d.in
                mockTask(testDir, 'move');
                // Download all files
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'expectedFiles'), testDir);
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Tools Installer Tests', (): void => {
        runSyncTest(
            'Download CLI',
            (): void => {
                const testDir: string = 'toolsInstaller';
                // Clean tool cache
                TestUtils.cleanToolCache();
                assert.ok(toolLib.findLocalToolVersions('jf').length === 0, 'tool already exists in cache');
                // Run tools installer to download CLI from a fresh repository
                mockTask(testDir, 'toolsInstaller');
                assert.ok(toolLib.findLocalToolVersions('jf').length === 1, 'tool was not downloaded to cache');
                // Run tools installer again to make sure the JFrog CLI downloaded from Artifactory remote cache
                mockTask(testDir, 'toolsInstaller');
                assert.ok(toolLib.findLocalToolVersions('jf').length === 1, 'tool is missing from cache');
            },
            TestUtils.isSkipTest('installer')
        );

        runSyncTest(
            'Download Custom CLI version',
            (): void => {
                const testDir: string = 'toolsInstaller';
                // Clean tool cache
                TestUtils.cleanToolCache();
                assert.ok(toolLib.findLocalToolVersions('jf').length === 0, 'tool already exists in cache');
                // Run tools installer to download CLI from a fresh repository
                mockTask(testDir, 'toolsInstallerCustomVersion');
                assert.ok(toolLib.findLocalToolVersions('jf').length === 1, 'tool was not downloaded to cache');
            },
            TestUtils.isSkipTest('installer')
        );
    });

    describe('Upload and Download Tests', (): void => {
        runSyncTest(
            'Upload and download',
            (): void => {
                const testDir: string = 'uploadAndDownload';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'download');
              //  assertFiles(path.join(testDir, 'files'), testDir);
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Move Copy Delete Tests', (): void => {
        runSyncTest(
            'Move Copy Delete',
            (): void => {
                const testDir: string = 'moveCopyDelete';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'move');
                mockTask(testDir, 'copy');
                mockTask(testDir, 'delete');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'expectedFiles'), testDir);
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Publish Build Info Tests', (): void => {
        runSyncTest(
            'Publish build info',
            (): void => {
                const testDir: string = 'publishBuildInfo';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'download');
                mockTask(testDir, 'publish');
                assertFiles(path.join(testDir, 'files'), testDir);
                const build: syncRequest.Response = getAndAssertBuild('buildPublish', '3');
                assertBuildModule(build, 'myUploadModule');
                assertBuildModule(build, 'myDownloadModule');
                deleteBuild('buildPublish');
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Exclude Environment Variables',
            (): void => {
                const testDir: string = 'excludeEnv';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'publish');
                const build: syncRequest.Response = getAndAssertBuild('excludeEnv', '3');
                assertBuildEnv(build, 'buildInfo.env.BUILD_DEFINITIONNAME', 'excludeEnv');
                assertBuildEnv(build, 'buildInfo.env.BUILD_BUILDNUMBER', '3');
                assertBuildEnv(build, 'buildInfo.env.BUILD_UNDEFINED', 'undefined');
                assertBuildEnv(build, 'buildInfo.env.BUILD_NULL', 'null');
                // Only *password* should be excluded
                assertBuildEnv(build, 'buildInfo.env.BUILD_PASSWORD', undefined);
                assertBuildEnv(build, 'buildInfo.env.BUILD_TOKEN', 'open-sesame');
                assertBuildEnv(build, 'buildInfo.env.BUILD_SECRET', 'open-sesame');
                deleteBuild('excludeEnv');
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Build URL build pipeline',
            (): void => {
                const testDir: string = 'buildUrlBuildPipeline';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'publish');
                const build: syncRequest.Response = getAndAssertBuild('buildUrlBuildPipeline', '3');
                assertBuildUrl(build, 'https://ecosys.visualstudio.com/ecosys/_build?buildId=5');
                deleteBuild('buildUrlBuildPipeline');
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Build URL release pipeline',
            (): void => {
                const testDir: string = 'buildUrlReleasePipeline';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'publish');
                const build: syncRequest.Response = getAndAssertBuild('buildUrlReleasePipeline', '3');
                assertBuildUrl(build, 'https://ecosys.visualstudio.com/ecosys/_release?releaseId=6');
                deleteBuild('buildUrlReleasePipeline');
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Build Promotion Tests', (): void => {
        runSyncTest(
            'Build promotion',
            (): void => {
                const testDir: string = 'promotion';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'publish');
                mockTask(testDir, 'promote');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), testDir);
                getAndAssertBuild('buildPromote', '3');
                deleteBuild('buildPromote');
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Build promotion dry run',
            (): void => {
                const testDir: string = 'promotionDryRun';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'publish');
                mockTask(testDir, 'promote');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), testDir);
                getAndAssertBuild('buildPromoteDryRun', '3');
                deleteBuild('buildPromoteDryRun');
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Discard Builds Tests', (): void => {
        runSyncTest(
            'Discard builds',
            (): void => {
                const testDir: string = 'discard';
                for (let i: number = 1; i <= 4; i++) {
                    mockTask(testDir, 'upload' + i.toString());
                    mockTask(testDir, 'publish' + i.toString());
                }

                // Discard with MaxBuilds 3
                getAndAssertBuild('buildDiscard', '1');
                mockTask(testDir, 'discardMaxBuilds');
                assertDiscardedBuild('buildDiscard', '1');
                for (let i: number = 2; i <= 4; i++) {
                    getAndAssertBuild('buildDiscard', i.toString());
                }

                // Discard with MaxDays -1 and Exclude 2,3
                // MaxDays = -1 means the earliest build date to store is tomorrow, i.e. all builds discarded.
                mockTask(testDir, 'discardMaxDaysExclude');
                getAndAssertBuild('buildDiscard', '2');
                getAndAssertBuild('buildDiscard', '3');
                assertDiscardedBuild('buildDiscard', '4');

                // Discard with MaxDays -1
                mockTask(testDir, 'discardMaxDays');
                assertDiscardedBuild('buildDiscard', '2');
                assertDiscardedBuild('buildDiscard', '3');

                deleteBuild('buildDiscard');
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Properties Tests', (): void => {
        runSyncTest(
            'Set properties',
            (): void => {
                const testDir: string = 'setProperties';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'set');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), testDir);
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Delete properties',
            (): void => {
                const testDir: string = 'deleteProperties';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'set');
                mockTask(testDir, 'delete');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'filesExpectedDelete'), testDir);
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Npm Tests', (): void => {
        runSyncTest(
            'Npm install and publish',
            (): void => {
                const testDir: string = 'npm';
                mockTask(testDir, path.join('install', 'npmInstall'));
                mockTask(testDir, path.join('install', 'installNpmPublish'));
                mockTask(testDir, path.join('install', 'installDownload'));
                mockTask(testDir, path.join('install', 'installPublish'));
                assertFiles(path.join(testDir, 'files'), path.join(testDir, '1'));
                getAndAssertBuild('npm Test', '1');
                deleteBuild('npm Test');
            },
            TestUtils.isSkipTest('npm')
        );
        runSyncTest(
            'Npm ci and publish',
            (): void => {
                const testDir: string = 'npm';
                mockTask(testDir, path.join('ci', 'npmCi'));
                mockTask(testDir, path.join('ci', 'ciNpmPublish'));
                mockTask(testDir, path.join('ci', 'ciDownload'));
                mockTask(testDir, path.join('ci', 'ciPublish'));
                assertFiles(path.join(testDir, 'files'), path.join(testDir, '2'));
                getAndAssertBuild('npm Test', '2');
                deleteBuild('npm Test');
            },
            TestUtils.isSkipTest('npm')
        );
    });

    describe('Maven Tests', (): void => {
        runSyncTest(
            'Maven',
            (): void => {
                const testDir: string = 'maven';
                mockTask(testDir, 'build');
                mockTask(testDir, 'publish');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files'));
                const build: syncRequest.Response = getAndAssertBuild('Maven Test', '3');
                const body: any = JSON.parse(build.getBody('utf8'));
                const modules: any[] = body.buildInfo.modules;
                assert.ok(!!modules);
                assert.ok(modules.length > 0);
                assert.ok(modules[0].artifacts.length === 2);
                assert.ok(modules[0].excludedArtifacts.length === 2);
                assert.ok(modules[0].dependencies.length === 2);
                deleteBuild('Maven Test');
            },
            TestUtils.isSkipTest('maven')
        );
    });

    describe('Gradle Tests', (): void => {
        runSyncTest(
            'Gradle',
            (): void => {
                const testDir: string = 'gradle';
                mockTask(testDir, path.join('gradle-example', 'build'));
                mockTask(testDir, path.join('gradle-example', 'publish'));
                mockTask(testDir, path.join('gradle-example', 'download'));
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files', 'gradle-example'));
                getAndAssertBuild('Gradle Test', '3');
                deleteBuild('Gradle Test');
            },
            TestUtils.isSkipTest('gradle')
        );
        runSyncTest(
            'Gradle CI',
            (): void => {
                const testDir: string = 'gradle';
                mockTask(testDir, path.join('gradle-example-ci', 'build'));
                mockTask(testDir, path.join('gradle-example-ci', 'publish'));
                mockTask(testDir, path.join('gradle-example-ci', 'download'));
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files', 'gradle-example-ci'));
                getAndAssertBuild('Gradle CI Test', '3');
                deleteBuild('Gradle CI Test');
            },
            TestUtils.isSkipTest('gradle')
        );
    });

    describe('Go Tests', (): void => {
        runSyncTest(
            'Go',
            (): void => {
                const testDir: string = 'go';
                mockTask(testDir, 'build');
                mockTask(testDir, 'goPublish');
                mockTask(testDir, 'download');
                mockTask(testDir, 'publishBuildInfo');
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files'));
                getAndAssertBuild('Go Test', '3');
                deleteBuild('Go Test');
            },
            TestUtils.isSkipTest('go')
        );
    });

    describe('NuGet Tests', (): void => {
        runSyncTest(
            'NuGet restore',
            (): void => {
                const testDir: string = 'nuget';
                mockTask(testDir, 'restore');
                mockTask(testDir, 'publish');
                getAndAssertBuild('NuGet Test', '3');
                deleteBuild('NuGet Test');
            },
            TestUtils.isSkipTest('nuget')
        );
        runSyncTest(
            'NuGet push',
            (): void => {
                const testDir: string = 'nuget';
                mockTask(testDir, 'push');
                mockTask(testDir, 'publish');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files'));
                getAndAssertBuild('NuGet Test', '3');
                deleteBuild('NuGet Test');
            },
            TestUtils.isSkipTest('nuget')
        );
    });

    describe('Dotnet Tests', (): void => {
        runSyncTest(
            'Dotnet restore',
            (): void => {
                const testDir: string = 'dotnet';
                mockTask(testDir, 'restore');
                mockTask(testDir, 'publish');
                getAndAssertBuild('DotNET Test', '7');
                deleteBuild('DotNET Test');
            },
            TestUtils.isSkipTest('dotnet')
        );
        runSyncTest(
            'Dotnet push',
            (): void => {
                const testDir: string = 'dotnet';
                mockTask(testDir, 'push');
                mockTask(testDir, 'publish');
                mockTask(testDir, 'download');
                assertFiles(path.join(testDir, 'files'), path.join(testDir, 'files'));
                getAndAssertBuild('DotNET Test', '7');
                deleteBuild('DotNET Test');
            },
            TestUtils.isSkipTest('dotnet')
        );
    });

    describe('Docker Tests', (): void => {
        runSyncTest(
            'Docker push, pull and scan',
            (): void => {
                assert.ok(TestUtils.platformDockerDomain, 'Tests are missing environment variable: ADO_JFROG_PLATFORM_DOCKER_DOMAIN');

                const testDir: string = 'docker';
                const filesDir: string = TestUtils.isWindows() ? 'windowsFiles' : 'unixFiles';

                // Run docker build + tag
                execSync(
                    `docker build -t ${platformDockerDomain}/docker-local/docker-test:1 ${path.join(__dirname, 'resources', testDir, filesDir)}`
                );

                // run docker push
                mockTask(testDir, 'push');
                mockTask(testDir, 'publishPush');
                getAndAssertBuild('dockerTest', '1');

                // Run docker pull
                mockTask(testDir, 'pull');
                mockTask(testDir, 'publishPull');
                getAndAssertBuild('dockerTest', '2');

                // Run docker scan
                mockTask(testDir, 'scan');

                // Clean
                deleteBuild('dockerTest');
            },
            TestUtils.isSkipTest('docker')
        );
    });

    describe('Collect Issues Tests', (): void => {
        runSyncTest(
            'Collect Issues',
            (): void => {
                const testDir: string = 'collectIssues';
                mockTask(testDir, 'collect');
                mockTask(testDir, 'publish');
                assertIssuesCollection('Collect issues', '3');
                deleteBuild('Collect issues');
            },
            TestUtils.isSkipTest('generic')
        );

        runSyncTest(
            'Collect Issues from file',
            (): void => {
                const testDir: string = 'collectIssues';
                mockTask(testDir, 'collectFromFile');
                mockTask(testDir, 'publishFromFile');
                assertIssuesCollection('Collect issues from file', '4');
                deleteBuild('Collect issues from file');
            },
            TestUtils.isSkipTest('generic')
        );
    });

    describe('Conan Task Tests', (): void => {
        runSyncTest(
            'Conan Custom Command',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanCustomCommand');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Custom Command With Working Dir',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanCustomCommandWithWorkingDir');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Custom Invalid Command',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanCustomInvalidCommand', true);
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Custom Command With Build Info',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanCustomCommandWithBuildInfo');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Add Remote',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanAddRemote');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Add Remote With Purge',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanAddRemoteWithPurge');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Create And Upload',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanAddRemote');
                mockTask(testDir, 'conanCreate');
                mockTask(testDir, 'conanUpload');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Create And Upload in Release',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanAddRemote');
                mockTask(testDir, 'conanCreate');
                mockTask(testDir, 'conanUploadInRelease');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Install',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanInstall');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Add Config',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanConfigInstall');
            },
            TestUtils.isSkipTest('conan')
        );

        runSyncTest(
            'Conan Publish Build Info',
            (): void => {
                const testDir: string = 'conanTask';
                mockTask(testDir, 'conanAddRemote');
                mockTask(testDir, 'conanCreate');
                mockTask(testDir, 'conanUpload');
                mockTask(testDir, 'publishBuildInfo');
                getAndAssertBuild('conanTask', '1');
                deleteBuild('conanTask');
            },
            TestUtils.isSkipTest('conan')
        );
    });

    describe('Pip Tests', (): void => {
        runSyncTest(
            'Pip Install',
            (): void => {
                const testDir: string = 'pip';
                mockTask(testDir, 'install');
                mockTask(testDir, 'publish');
                getAndAssertBuild('Pip Test', '17');
                deleteBuild('Pip Test');
            },
            TestUtils.isSkipTest('pip')
        );
    });

    describe('Distribution Tests', (): void => {
        let rbName: string;
        let rbVersion: string;
        before(function(): void {
            this.timeout(180000); // 3 minutes timer for the before hook only.
            if (!TestUtils.isSkipTest('distribution')) {
                rbName = 'ado-test-rb';
                rbVersion = '123';
                distributionCleanUp(rbName, rbVersion);
            }
        });

        runSyncTest(
            'Distribution',
            (): void => {
                const testDir: string = 'distribution';
                mockTask(testDir, 'upload');
                mockTask(testDir, 'create');
                assertLocalReleaseBundle(rbName, rbVersion, true, ['OPEN'], 'ADO DESC');
                mockTask(testDir, 'update');
                assertLocalReleaseBundle(rbName, rbVersion, true, ['OPEN'], 'ADO DESC UPDATE');
                mockTask(testDir, 'sign');
                assertLocalReleaseBundle(rbName, rbVersion, true, ['SIGNED', 'STORED', 'READY_FOR_DISTRIBUTION'], '');
                mockTask(testDir, 'distributeDryRun');
                assertRemoteReleaseBundle(rbName, rbVersion, false);
                mockTask(testDir, 'distribute');
                assertRemoteReleaseBundle(rbName, rbVersion, true);
                mockTask(testDir, 'delete');
                waitForBundleDeletion(rbName, rbVersion, true).catch((): string => 'deletion failed');
            },
            TestUtils.isSkipTest('distribution')
        );

        after(function(): void {
            this.timeout(180000); // 3 minutes timer for the after hook only.
            distributionCleanUp(rbName, rbVersion);
        });
    });
});

function distributionCleanUp(rbName: string, rbVersion: string): void {
    if (!TestUtils.isSkipTest('distribution')) {
        TestUtils.deleteReleaseBundle(rbName, rbVersion);
        waitForBundleDeletion(rbName, rbVersion, false).catch((): string => 'deletion failed');
    }
}

/**
 * Run a sync test using mocha suit.
 *
 * @param description (String) - Test description
 * @param testFunc (Function) - The test logic
 * @param skip (Boolean, Optional) - True if test should be skipped
 */
function runSyncTest(description: string, testFunc: () => void, skip?: boolean): void {
    if (skip) {
        it.skip(description);
        return;
    }

    it(description, (done): void => {
        testFunc();
        done();
    }).timeout(360000); // 6 minutes
}

/**
 * Run an async test using mocha suit.
 *
 * @param description (String) - Test description
 * @param testFunc (Function) - The test logic
 * @param skip (Boolean, Optional) - True if test should be skipped
 */

function runAsyncTest(description: string, testFunc: (done: mocha.Done) => void, skip?: boolean): void {
    if (skip) {
        it.skip(description);
        return;
    }

    it(description, (done): void => {
        testFunc(done);
    }).timeout(300000); // 5 minutes
}

/**
 * Mock a task from resources directory.
 *
 * @param testDir (String) - The test directory in resources
 * @param taskName (String) - The '.js' file
 * @param shouldFail (Boolean, Optional) - True if the task supposed to fail
 */
function mockTask(testDir: string, taskName: string, shouldFail?: boolean): void {
    const taskPath: string = path.join(__dirname, 'resources', testDir, taskName + '.js');
    // task.json dummy passed to the mock runner to avoid the 'Unable to find task.json, ...' warnings.
    const taskJsonDummy: string = path.join(__dirname, 'resources', 'task.json');
    const mockRunner: adoMockTest.MockTestRunner = new adoMockTest.MockTestRunner(taskPath, taskJsonDummy);
    mockRunner.run(); // Mock a test
    tasksOutput += mockRunner.stderr + '\n' + mockRunner.stdout;
    assert.ok(shouldFail ? mockRunner.failed : mockRunner.succeeded, '\nFailure in: ' + taskPath + '.\n' + tasksOutput); // Check the test results
}

/**
 * Assert that the files that were downloaded to "testData" are correct.
 *
 * @param expectedFiles - (String) - The relative path of expected files under tests/resources
 * @param resultFiles - (String) - The relative path of result files under testDataDir
 */
function assertFiles(expectedFiles: string, resultFiles: string): void {
    // Check that all necessary files were downloaded to "testDir/<testName>/"
    const filesToCheck: string[] = [];
    const filesDir: string = path.join(__dirname, 'resources', expectedFiles);
    const testData: string = path.join(TestUtils.testDataDir, resultFiles);
    if (fs.existsSync(filesDir)) {
        for (const file of fs.readdirSync(filesDir)) {
            const fileName: string = path.basename(file);
            const fileToCheck: string = path.join(testData, fileName);
            assert.ok(fs.existsSync(fileToCheck), fileToCheck + ' does not exist.\n' + tasksOutput);
            filesToCheck.push(fileName);
        }
    }

    // Check that only necessary files were downloaded to "testDir/<testName>/"
    if (!fs.existsSync(testData) && filesToCheck.length === 0) {
        return;
    }
    for (const file of fs.readdirSync(testData)) {
        const fileName: string = path.basename(file);
        assert.ok(filesToCheck.indexOf(fileName) >= 0, fileName + ' should not exist.\n' + tasksOutput);
    }
}

/**
 * Get build from Artifactory and assert that it exists.
 *
 * @param buildName - (String) - The build name
 * @param buildNumber - (String) - The build number
 */
function getAndAssertBuild(buildName: string, buildNumber: string): syncRequest.Response {
    const build: syncRequest.Response = TestUtils.getBuild(buildName, buildNumber);
    assertBuild(build, buildName, buildNumber);
    return build;
}

/**
 * Assert that a build DOESN'T exist in artifactory.
 *
 * @param buildName - (String) - The build name
 * @param buildNumber - (String) - The build number
 */
function assertDiscardedBuild(buildName: string, buildNumber: string): void {
    const build: syncRequest.Response = TestUtils.getBuild(buildName, buildNumber);
    assert.ok(build.statusCode === 404, 'Build ' + buildName + '/' + buildNumber + ' exist in Artifactory and is not discarded.\n' + tasksOutput);
}

/**
 * Assert build environment in the build.
 *
 * @param build - (Object) - The build object returned from Artifactory
 * @param key - (String) - The build environment key
 * @param value - (String | Undefined) - The build environment value
 */
function assertBuildEnv(build: syncRequest.Response, key: string, value: string | undefined): void {
    const body: any = JSON.parse(build.getBody('utf8'));
    const actual: string = body.buildInfo.properties[key];
    assert.strictEqual(actual, value, "Expected: '" + key + ' = ' + value + "'. Actual: '" + key + ' = ' + actual + "'.\n" + tasksOutput);
}

/**
 * Assert module in the build.
 *
 * @param build - (Object) - The build object returned from Artifactory
 * @param moduleID - (String) - The module ID
 */
function assertBuildModule(build: any, moduleID: string): void {
    const body: any = JSON.parse(build.getBody('utf8'));
    const modules: any[] = body.buildInfo.modules;
    let found: boolean = false;
    for (const item of modules) {
        if (item.id === moduleID) {
            found = true;
            break;
        }
    }
    assert.strictEqual(found, true, 'Module "' + moduleID + '" should be exist in buildInfo, but it does not');
}

function assertBuildUrl(build: any, url: string): void {
    const body: any = JSON.parse(build.getBody('utf8'));
    assert.strictEqual(body.buildInfo.url, url);
}

function assertBuild(build: any, buildName: string, buildNumber: string): void {
    assert.ok(
        build.statusCode < 300 && build.statusCode >= 200,
        'Build ' + buildName + '/' + buildNumber + " doesn't exist in Artifactory.\n" + tasksOutput
    );
}

function deleteBuild(buildName: string): void {
    TestUtils.deleteBuild(buildName);
}

function assertLocalReleaseBundle(bundleName: string, bundleVersion: string, expectExist: boolean, state: string[], description: string): void {
    const response: syncRequest.Response = TestUtils.getLocalReleaseBundle(bundleName, bundleVersion, expectExist);
    if (expectExist) {
        const body: any = JSON.parse(response.getBody('utf8'));
        assert.ok(body.name === bundleName, 'Wrong bundle name');
        assert.ok(body.version === bundleVersion, 'Wrong bundle version');
        assert.ok(state.includes(body.state), 'Wrong bundle state');
        if (description) {
            assert.ok(body.description === description, 'Wrong bundle description');
        }
    }
}

function assertRemoteReleaseBundle(bundleName: string, bundleVersion: string, expectExist: boolean): void {
    const response: syncRequest.Response = TestUtils.getRemoteReleaseBundle(bundleName, bundleVersion);
    assert.ok(
        response.statusCode === 200,
        'Expected operation to succeed. Status code: ' + response.statusCode + '. Error: ' + response.getBody('utf8')
    );
    let bodyStr: string = response.getBody('utf8');
    if (bodyStr[0] !== '[') {
        bodyStr = '[' + bodyStr + ']';
    }
    const body: any = JSON.parse(bodyStr);

    if (!expectExist) {
        assert.ok(body.length === 0, 'Expected no remote release bundles.');
        return;
    }
    assert.ok(body[0].status === 'Completed', 'Wrong bundle state');
}

async function waitForBundleDeletion(bundleName: string, bundleVersion: string, doAssert: boolean): Promise<void> {
    // Wait for deletion of release bundle.
    for (let i: number = 0; i < 120; i++) {
        const response: syncRequest.Response = TestUtils.getRemoteReleaseBundle(bundleName, bundleVersion);
        if (response.statusCode === 404) {
            return;
        }
        const failMsg: string = 'Expected operation to succeed. Status code: ' + response.statusCode + '. Error: ' + response.getBody('utf8');
        if (response.statusCode !== 200) {
            if (doAssert) {
                assert.fail(failMsg);
            } else {
                console.log(failMsg);
                return;
            }
        }
        console.log('Waiting for distribution deletion ' + bundleName + '/' + bundleVersion + '...');
        await sleep(1000);
    }
    const timeoutMsg: string = 'Timeout for release bundle deletion ' + bundleName + '/' + bundleVersion;
    if (doAssert) {
        assert.fail(timeoutMsg);
    } else {
        console.log(timeoutMsg);
        return;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve): any => setTimeout(resolve, ms));
}

function assertPathExists(pathToCheck: string): void {
    assert.ok(fs.existsSync(pathToCheck), pathToCheck + ' should exist!');
}

function assertIssuesCollection(buildName: string, buildNumber: string): void {
    // Get build from Artifactory.
    const build: syncRequest.Response = getAndAssertBuild(buildName, buildNumber);
    const body: any = JSON.parse(build.getBody('utf8'));

    // Check number of issues is correct.
    const expectedIssues: number = 4;
    const actualIssues: any[] = body.buildInfo.issues.affectedIssues;
    assert.ok(actualIssues.length === expectedIssues, "Expected: '" + expectedIssues + "' issues, actual: '" + actualIssues + "'.\n" + tasksOutput);

    // Check vcs url.
    const expectedVcsUrl: string = 'https://github.com/jfrog/jfrog-cli-go.git';
    const actualVcsUrl: string = body.buildInfo.vcs[0].url;
    assert.ok(expectedVcsUrl === actualVcsUrl, "Expected vcs url: '" + expectedVcsUrl + "', actual: '" + actualVcsUrl + "'.\n" + tasksOutput);

    // Check vcs revision.
    const expectedVcsRevision: string = 'b033a0e508bdb52eee25654c9e12db33ff01b8ff';
    const actualVcsRevision: string = body.buildInfo.vcs[0].revision;
    assert.ok(
        expectedVcsRevision === actualVcsRevision,
        "Expected vcs revision: '" + expectedVcsRevision + "', actual: '" + actualVcsRevision + "'.\n" + tasksOutput
    );
}

function testGetCliPartialsBuildDir(): void {
    const testDTO: any = {
        testBuildNumber: '777',
        testsBuildNames: ['simpleJFrogTestNameExample', 'Some-Special-Chars+:#$%\\/dè<>']
    };
    // Cleanup old partials
    testDTO.testsBuildNames.forEach((element: string): void => runBuildCommand('bc', element, testDTO.testBuildNumber));
    // Create new partials using "Build Collect Env" command
    testDTO.testsBuildNames.forEach((element: string): void => runBuildCommand('bce', element, testDTO.testBuildNumber));
    // Assert the partials created at the generated by getCliPartialsBuildDir() path
    testDTO.testsBuildNames.forEach((element: string): void => assertPathExists(conanUtils.getCliPartialsBuildDir(element, testDTO.testBuildNumber)));
    // Cleanup the created partials
    testDTO.testsBuildNames.forEach((element: string): void => runBuildCommand('bc', element, testDTO.testBuildNumber));
}

function runBuildCommand(command: string, buildName: string, buildNumber: string): void {
    jfrogUtils.executeCliCommand('jf rt ' + command + ' "' + buildName + '" ' + buildNumber, TestUtils.testDataDir);
}
