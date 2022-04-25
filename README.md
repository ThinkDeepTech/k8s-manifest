# k8s-manifest
Simple interface providing kubernetes javascript client object creation by use of yaml strings or objects.

# Dependencies
- [Kubernetes javascript client](https://github.com/kubernetes-client/javascript) v0.15
- [Node v16.14.2 LTS](https://nodejs.org/en/)

# Installation
```console
    npm i @thinkdeep/k8s-manifest
```

# Usage

```javascript

    import { k8sManifest, stringify } from '@thinkdeep/k8s-manifest';

    const options = {
        name: 'dynamic-cron-job',
        namespace: 'production',
        schedule: '* * * * *',
        image: 'busybox',
        command: 'echo',
        args: ['Hello World']
    };

    // Assuming environment variables have been defined...
    const cronJob = k8sManifest(`
        apiVersion: "batch/v1"
        kind: "CronJob"
        metadata:
            name: "${options.name}"
            namespace: "${options.namespace || "default"}"
        spec:
            schedule: "${options.schedule}"
            jobTemplate:
                spec:
                    template:
                        spec:
                            containers:
                                - name: "${process.env.HELM_RELEASE_NAME}-data-collector"
                                    image: "${options.image}"
                                    command: ["${options.command}"]
                                    args: ${JSON.stringify(options.args)}
                                    envFrom:
                                    - secretRef:
                                        name: "${process.env.HELM_RELEASE_NAME}-deep-microservice-collection-secret"
                                    ${ process.env.PREDECOS_KAFKA_SECRET ? `
                                    - secretRef:
                                        name: "${process.env.PREDECOS_KAFKA_SECRET}"
                                    ` : ``}
                            serviceAccountName: "${process.env.HELM_RELEASE_NAME}-secret-accessor-service-account"
                            restartPolicy: "Never"
                            imagePullSecrets:
                                - name: "docker-secret"
    `);

    const pod = k8sManifest({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
            name: 'sample-pod'
        },
        spec: {
            containers: [{
                name: 'container-name',
                image: 'nginx'
            }],
            dnsPolicy: "ClusterFirst",
            imagePullSecrets: [{
                name: "docker-secret"
            }],
            restartPolicy: "Never",
            schedulerName: "default-scheduler",
            securityContext: {},
            serviceAccount: "service-account",
            serviceAccountName: "service-account-name",
            terminationGracePeriodSeconds: 30
        }
    });

    console.log(`The first new object is: \n${stringify(cronJob)}`);

    console.log(`The second new object is: \n${stringify(pod)}`);

```