import pino from 'pino';
import {createGcpLoggingPinoConfig} from "@google-cloud/pino-logging-gcp-config";

function defaultTransport() {
    return pino.transport({
        target: "pino-pretty",
        options: { destination: 1 }
    });
}

function createRootLogger() {
    if (process.env.CLOUD_RUN_JOB !== undefined) {
        return pino(createGcpLoggingPinoConfig());
    }
    return pino(defaultTransport());
}

const ROOT = createRootLogger();


export function loggerFactory(props: any) {
    return ROOT.child(props);
}