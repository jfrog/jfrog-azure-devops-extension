'use strict';
define(['TFS/DistributedTask/TaskRestClient'], (taskRestClient) => {
    let sharedConfig = VSS.getConfiguration();
    let vsoContext = VSS.getWebContext();
    if (sharedConfig) {
        // Register your extension with host through callback.
        sharedConfig.onBuildChanged((build) => {
            let taskClient = taskRestClient.getClient();

            let planId = build.orchestrationPlan.planId;

            // Get the content of the first attachment of the given type, or null when there is none.
            let fetchAttachment = (type, name) =>
                taskClient.getPlanAttachments(vsoContext.project.id, 'build', planId, type).then((taskAttachments) => {
                    if (taskAttachments.length === 0) {
                        return null;
                    }
                    let recId = taskAttachments[0].recordId;
                    let timelineId = taskAttachments[0].timelineId;
                    return taskClient
                        .getAttachmentContent(vsoContext.project.id, 'build', planId, timelineId, recId, type, name)
                        .then((attachmentContent) => JSON.parse(bufferToString(attachmentContent)));
                });

            // Show the build-info link from the 'artifactoryType' attachment published by the build agent,
            // then the Xray report when Build Scan published one. Stay quiet about Xray when it did not:
            // a missing attachment means this run did not scan, not that a scan was skipped.
            Promise.all([
                fetchAttachment('artifactoryType', 'buildDetails'),
                fetchAttachment('xrayType', 'scanDetails').catch((error) => {
                    console.error('Could not read the Xray scan report link: ' + error);
                    return null;
                }),
            ]).then(([buildDetails, scanUrl]) => {
                let parentDiv = $('#artifactory-build-info-parent');
                parentDiv.append(buildDetails ? createBuildInfoDiv(buildDetails) : createNoBuildInfoDiv());
                if (isWebUrl(scanUrl)) {
                    parentDiv.append(createXrayScanDiv(scanUrl));
                }
            });

            VSS.notifyLoadSucceeded();
        });
    }

    // Only http and https links are shown, whatever the attachment holds.
    function isWebUrl(value) {
        try {
            return ['http:', 'https:'].includes(new URL(value).protocol);
        } catch (error) {
            return false;
        }
    }

    function bufferToString(buffer) {
        let obj = new Uint8Array(buffer);
        return String.fromCharCode.apply(String, obj);
    }

    /**
     * Create a div element with build-info icon and <buildname>/<buildnumber> with hyperlink to Artifactory.
     * @param buildDetails - Contains 'artifactoryUrl', 'buildName' and 'buildNumber'
     */
    function createBuildInfoDiv(buildDetails) {
        let buildInfoDiv = document.createElement('div');
        let buildInfoIcon = document.createElement('img');
        let buildInfoUrlDiv = document.createElement('a');

        buildInfoIcon.src = 'images/artifactory-build-info.png';
        buildInfoUrlDiv.classList.add('build-info-url');
        // Supported since JFrog CLI version 2.17.0.
        if (buildDetails.buildInfoUiUrl) {
            buildInfoUrlDiv.href = buildDetails.buildInfoUiUrl;
        } else {
            // Backward compatibility - if a lower JFrog CLI version is used,
            // or for tasks that completed before the above functionality was introduced.
            buildInfoUrlDiv.href =
                stripTrailingSlash(buildDetails.artifactoryUrl) + '/webapp/builds/' + buildDetails.buildName + '/' + buildDetails.buildNumber;
        }
        buildInfoUrlDiv.text = 'Artifactory Build Info';
        buildInfoUrlDiv.target = '_blank';
        buildInfoDiv.append(buildInfoIcon);
        buildInfoDiv.append(buildInfoUrlDiv);
        return buildInfoDiv;
    }

    /**
     * Link to the Xray build scan report. scanUrl is the string the task stored.
     * @param {string} scanUrl
     */
    function createXrayScanDiv(scanUrl) {
        let xrayScanDiv = document.createElement('div');
        let xrayScanIcon = document.createElement('img');
        let xrayScanUrlDiv = document.createElement('a');

        xrayScanIcon.src = 'images/artifactory-xray-scan.png';
        xrayScanUrlDiv.classList.add('xray-scan-url');
        xrayScanUrlDiv.href = scanUrl;
        xrayScanUrlDiv.text = 'Xray Build Scan Report';
        xrayScanUrlDiv.target = '_blank';
        xrayScanDiv.append(xrayScanIcon);
        xrayScanDiv.append(xrayScanUrlDiv);
        return xrayScanDiv;
    }

    function createNoBuildInfoDiv() {
        let noBuildInfoDiv = document.createElement('p');
        noBuildInfoDiv.classList.add('build-info-url');
        noBuildInfoDiv.innerText = 'Build Info is not published to Artifactory';
        return noBuildInfoDiv;
    }

    function stripTrailingSlash(str) {
        return str.endsWith('/') ? str.slice(0, -1) : str;
    }
});
