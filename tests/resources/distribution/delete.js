const testUtils = require('../../testUtils');
const join = require('path').join;
const writeFileSync = require('fs-extra').writeFileSync;

const filePath = join(testUtils.testDataDir, 'deleteSpec.json');

writeFileSync(
    filePath,
    JSON.stringify({
        distribution_rules: [
            {
                site_name: '*',
                city_name: '*',
                country_codes: ['*'],
            },
        ],
    }),
    'utf8'
);

let inputs = {
    command: 'delete',
    rbName: 'ado-test-rb',
    rbVersion: '123',
    distRulesSource: 'file',
    distRulesFilePath: filePath,
    deleteFromDist: true,
    dryRun: false,
    insecureTls: false,
};

testUtils.runDistributionTask(testUtils.distribution, {}, inputs);
