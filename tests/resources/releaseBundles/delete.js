const testUtils = require('../../testUtils');
const path = require('path');
const fs = require('fs-extra');
const filePath = path.join(testUtils.testDataDir, 'deleteSpec.json');

fs.writeFileSync(
    filePath,
    JSON.stringify({
        distribution_rules: [
            {
                site_name: '*',
                city_name: '*',
                country_codes: ['*']
            }
        ]
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
    insecureTls: false
};

testUtils.runDistTask(testUtils.releaseBundle, {}, inputs);
