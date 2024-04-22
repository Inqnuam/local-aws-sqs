export const xmlVersion = `<?xml version="1.0"?>`;
export const xmlns = `xmlns="http://queue.amazonaws.com/doc/2012-11-05/"`;

export const reqId = (RequestId: string) => `<RequestId>${RequestId}</RequestId>`;
export const ResponseMetadata = (RequestId: string) => `<ResponseMetadata>${reqId(RequestId)}</ResponseMetadata>`;
export const ErrorResponse = (RequestId: string, Error: { Type?: string; Code: string; Message: string; Detail?: string }) => `${xmlVersion}<ErrorResponse ${xmlns}>
<Error>
<Type>Sender</Type>
<Code>${Error.Code}</Code>
<Message>${Error.Message}</Message>
<Detail/>
</Error>
${reqId(RequestId)}
</ErrorResponse>`;
