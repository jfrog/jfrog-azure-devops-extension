## We Created a New Extension
### General
We have recently released a new extension for Azure DevOps - the [JFrog Azure DevOps Extension](https://marketplace.visualstudio.com/items?itemName=JFrog.jfrog-azure-devops-extension). The new extension can be installed and used side by side with this extension. 
If you're already using the Artifactory Azure DevOps Extension, we recommend also installing the new [JFrog Azure DevOps Extension](https://marketplace.visualstudio.com/items?itemName=JFrog.jfrog-azure-devops-extension), and gradually migrating your tasks from the old extension to the new one. 
The old extension will continue to be supported, however new functionality will most likely make it into the new extension only.

### Why?
We want to make sure new functionality and improvements are added to the extension. 
However, our primary goal is making sure your pipelines and releases continue to function as expected by maintaining backward compatibility. 
As more changes were added however, we were approaching the extension size limit. 
In addition, following the need to start utilizing JFrog CLI v2, which includes breaking changes compared to v1, it seemed like the right time to create a new extension, that can run together with the old one, and allow you to gradually migrate when the time is right for you.

### What's changed in the new extension?
- The new extension utilizes [JFrog CLI v2](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI#JFrogCLI-JFrogCLIv2)
- The old extension's **Artifactory Generic Upload**, **Artifactory Generic Download** and **Artifactory Properties** tasks are replaced in the new extension with the **JFrog Generic Artifacts** task
- In addition to the above, the new **JFrog Generic Artifacts** task also supports copying, moving and deleting artifacts on Artifactory
- The new **JFrog Audit** task added to the new extension allows auditing your projects for security vulnerabilities with JFrog Xray

### Still missing in the new extension
The **Artifactory Docker** task hasn't yet been migrated to the new extension. This is because we're currently working on further improving JFrog CLI's integration with the docker client, and would like to expose the new docker functionally to the new extension once that effort is completed. As the old extension is here to stay, you can continue using its **Artifactory Docker** task.

### New vs. old tasks
To help you migrate your tasks from the old Artifactory Extension to the new JFrog Extension, we listed the old vs. new tasks names for you.

|  **Artifactory Extension Task**  |   **JFrog Extension Task**   |
|:--------------------------------:|:----------------------------:|
|   Artifactory Tools Installer    |    JFrog Tools Installer     |
|    Artifactory Generic Upload    |   JFrog Generic Artifacts    |
|   Artifactory Generic Download   |   JFrog Generic Artifacts    |
|      Artifactory Properties      |   JFrog Generic Artifacts    |
|        Artifactory Maven         |         JFrog Maven          |
|        Artifactory Gradle        |         JFrog Gradle         |
|         Artifactory Npm          |          JFrog Npm           |
|        Artifactory Nuget         |         JFrog Nuget          |
|      Artifactory .NET Core       |       JFrog .NET Core        |
|         Artifactory Pip          |          JFrog Pip           |
|        Artifactory Conan         |         JFrog Conan          |
|          Artifactory Go          |           JFrog Go           |
| Artifactory Collect Build Issues |  JFrog Collect Build Issues  |
|  Artifactory Publish Build Info  |   JFrog Publish Build Info   |
|   Artifactory Build Promotion    |    JFrog Build Promotion     |
|      Artifactory Xray Scan       |       JFrog Build Scan       |
|    Artifactory Discard Builds    |     JFrog Discard Builds     |
|           Distribution           |      JFrog Distribution      |
|            JFrog CLI             |         JFrog CLI V2         |


## Overview
**JFrog Artifactory** is a Universal Repository Manager supporting all major packaging formats and build tools.

[Learn more](https://jfrog.com/artifactory/)

Artifactory provides tight integration Azure DevOps through the **JFrog Artifactory Extension.** 
In addition to managing efficient deployment of your artifacts to Artifactory, 
the extension lets you capture information about your build's resolved dependencies and deployed artifacts. 
Gain full traceability for your builds as the environment data associated with your build is automatically collected.

The extension currently supports the following package managers:
Maven, Gradle, npm, NuGet, Docker, Go, Pip and Conan. It also allows downloading and uploading generic files from and to Artifactory.

**JFrog Distribution** is a centralized platform that lets you provision software release distribution.

[Learn more](https://jfrog.com/distribution/)

The **JFrog Artifactory Extension** also allows managing Release Bundles and their distribution processes, including release content, and target destinations. 

## Documentation and source code
The full extension documentation is available [here](https://www.jfrog.com/confluence/display/JFROG/Artifactory+Azure+DevOps+Extension).
<br>
See the source code is on [GitHub](https://github.com/jfrog/artifactory-azure-devops-extension).

## Downloading generic build dependencies from Artifactory
The **Artifactory Generic Download** task supports downloading your build dependencies from Artifactory to the build agent. 
The task triggers the [JFrog CLI](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI) to perform the download. The downloaded dependencies are defined using [File Specs](https://www.jfrog.com/confluence/display/CLI/CLI+for+JFrog+Artifactory#CLIforJFrogArtifactory-UsingFileSpecs) 
and can be also configured to capture the build-info. 
It will store the downloaded files as dependencies in the build-info which can later be published to Artifactory using the **Artifactory Publish Build-Info** task.

![GenericDownload](images/marketplace/generic-download.png)

## Uploading generic build artifacts to Artifactory
The **Artifactory Generic Upload** task supports uploading your generated build artifacts from the build agent's local file system to Artifactory. 
The task triggers the [JFrog CLI](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI) to perform the upload. 
The artifacts are defined using [File Specs](https://www.jfrog.com/confluence/display/CLI/CLI+for+JFrog+Artifactory#CLIforJFrogArtifactory-UsingFileSpecs). 
The task can be also configured to capture build-info and stores the uploaded files as artifacts in the build-info. The captured build-info can be later published to Artifactory using the **Artifactory Publish Build-Info** task.

![GenericUpload](images/marketplace/generic-upload.png)

## Triggering NuGet, .NET Core CLI, Maven, Gradle, npm, Go, Pip and Conan builds
The extension adds the following tasks: **Artifactory NuGet**, **Artifactory .NET Core**, **Artifactory Maven**, **Artifactory Gradle**, **Artifactory npm** and **Artifactory Go** to support full build integration with Artifactory. All tasks allow resolving dependencies and deploying artifacts from and to Artifactory. These tasks can also be configured to capture build-info for the build. The captured build-info can be later published to Artifactory using the **Artifactory Publish Build-Info** task.

![PackageManagers](images/marketplace/package-managers.png)

## Pushing and pulling docker images
The **Artifactory Docker** task allows pushing and pulling docker images to and from Artifactory.
The task can also be configured to capture build-info for the build. The captured build-info can be later published to Artifactory using the **Artifactory Publish Build-Info** task.

![Docker](images/marketplace/docker.png)

## Setting / deleting properties on files in Artifactory
The **Artifactory Properties** task allows setting and deleting properties on both files in Artifactory.

![Props](images/marketplace/props.png)

## Scanning builds with JFrog Xray
The JFrog Artifactory extension integrates with JFrog Xray through JFrog Artifactory, allowing you to have build artifacts scanned for vulnerabilities and other issues using the **Artifactory Xray Scan** task.
If issues or vulnerabilities are found, you may choose to fail a build.

![Xray](images/marketplace/xray.png)

## Recording tracked issues
Being able to look at the build which was published to Artifactory, and see all the tracked issues (from JIRA for example) associated with it, is one of the most powerful capabilities of Artifactory when it comes to managing metadata about builds. The **Artifactory Collect Issues** tasks can automatically identify the issues handled in the current build, and record them as part of the build-info. Read more about this unique capability [here](https://www.jfrog.com/confluence/display/JFROG/Artifactory+Azure+DevOps+Extension#ArtifactoryAzureDevOpsExtension-CollectingBuildIssues).

## Publishing build-info
Build-info captured in preceding tasks can be published to Artifactory using the **Artifactory Publish Build-Info** task.
The configured build name & number should match the ones specified when the build-info was captured.

![BuildPublish](images/marketplace/build-publish.png)

## Promoting published builds 
Artifactory supports promoting published builds from one repository to another, 
to support the artifacts life-cycle. 
The **Artifactory Promotion** task promotes a build, by either copying or moving the build artifacts and/or dependencies to a target repository. 
This task can be added as part of a Release pipeline, to support the release process.

![BuildPromotion](images/marketplace/build-promotion.png)

## Discarding published builds 
The **Artifactory Discard Builds** task is used to discard previously published builds from Artifactory.
Builds are discarded according to the retention parameters configured in the task.

![Discard](images/marketplace/discard.png)

## Executing JFrog CLI commands
The **JFrog CLI** task allows executing [JFrog CLI](https://www.jfrog.com/confluence/display/CLI/JFrog+CLI) commands, while using the pre-configured connection details of JFrog Artifactory, stored in Azure DevOps.

## Accessing the Build-Info and the Xray scan report
You can access the build-info from the Build Results in Azure DevOps, if your build pipeline has published the build-info to Artifactory.
You can also access the Xray scan report, if your build pipeline is configured to scan the build.

![BuildInfo](images/marketplace/build-results.png)
![BuildInfo](images/marketplace/bi-in-artifactory.png)
![BuildInfo](images/marketplace/xray-report-in-xray.png)

## Releasing published builds
The **Artifactory Publish Build-Info** task allows publishing builds to Artifactory. By choosing Artifactory as an artifacts source in a Release, 
you can select a published build, to make its artifacts available for the release.

![ArtifactsSource](images/marketplace/artifacts-source.png)

## Handling Distribution
The **Distribution** task allows managing release bundles.
The task provides the capability to create, update, sign, distribute or delete release bundles from JFrog Distribution.

![Distribution](images/marketplace/distribution.png)