import pino from 'pino';

const transport = pino.transport({
    target: "pino-pretty",
    options: { destination: 1 }
});

const ROOT = pino(transport);


export function loggerFactory(props: any) {
    return ROOT.child(props);
}