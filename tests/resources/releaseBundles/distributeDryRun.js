const testUtils = require('../../testUtils');

let inputs = {
    command: 'distribute',
    rbName: 'ado-test-rb',
    rbVersion: testUtils.getRepoKeys().releaseBundleVersion,
    distRulesSource: 'taskConfiguration',
    distRulesTaskFile: JSON.stringify({
        distribution_rules: [
            {
                site_name: '*',
                city_name: '*',
                country_codes: ['*']
            }
        ]
    }),
    distSync: false,
    dryRun: true,
    insecureTls: false
};

testUtils.runDistTask(testUtils.releaseBundle, {}, inputs);
