**JFrog Artifactory** is a Universal Repository Manager supporting all major packaging formats and build tools.

[Learn more](https://jfrog.com/artifactory/)

Artifactory provides tight integration with TFS and VSTS through the **JFrog Artifactory Extension**. 
Beyond managing efficient deployment of your artifacts to Artifactory, the extension lets you capture information about artifacts deployed, dependencies resolved, 
environment data associated with your build runs and more, 
that effectively provides full traceability for your builds.

## Download build dependencies from Artifactory
The **Artifactory Generic Download** task allows downloading your build dependencies from Artifactory to the build agent.
The task utilizes [JFrog CLI](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI) to perform the download.
The downloaded dependencies are defined using [File Specs](https://www.jfrog.com/confluence/display/CLI/CLI+for+JFrog+Artifactory#CLIforJFrogArtifactory-UsingFileSpecs).
The task can also be configured to capture build-info. It will store the downloaded files as depedencies in the build-info.
The captured build-info can be later published to Artifactory using the **Artifactory Publish Build-Info** task.

![BuildInfo](images/marketplace/generic-download.png)

## Upload build artifacts to Artifactory
The **Artifactory Generic Upload** task allows uploading your generated build artifacts from the build agent's local file-system to Artifactory.
The task utilizes [JFrog CLI](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI) to perform the upload.
The artifacts are defined using [File Specs](https://www.jfrog.com/confluence/display/CLI/CLI+for+JFrog+Artifactory#CLIforJFrogArtifactory-UsingFileSpecs).
The task can also be configured to capture build-info. It will store the uploaded files as artifacts in the build-info.
The captured build-info can be later published to Artifactory using the **Artifactory Publish Build-Info** task.

![BuildInfo](images/marketplace/generic-upload.png)

## Promote published builds
Artifactory supports promoting published builds from one repository to another, 
to support the artifacts life-cycle.
The **Artifactory Promotion** task promotes a build, by either copying or moving the build artifacts and/or dependencies to a target repository.
This task can be added as part of a Release pipeline, to support the release process.

![BuildInfo](images/marketplace/build-promotion.png)

## Access the Build-Info
If your build pipeline published build-info to Artifactory, you can access the build-info
from the Build Results in VSTS.

![BuildInfo](images/marketplace/build-info.png)
![BuildInfo](images/marketplace/build-info-in-artifactory.png)
