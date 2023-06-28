const testUtils = require('../../testUtils');

let inputs = {
    command: 'distribute',
    rbName: 'ado-test-rb',
    rbVersion: '123',
    distRulesSource: 'taskConfiguration',
    distRulesTaskFile: JSON.stringify({
        distribution_rules: [
            {
                site_name: '*',
                city_name: '*',
                country_codes: ['*'],
            },
        ],
    }),
    distSync: false,
    dryRun: true,
    insecureTls: false,
};

testUtils.runDistributionTask(testUtils.distribution, {}, inputs);
