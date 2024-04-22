import { SqsCommand } from "./sqsCommand";
import { Queue } from "../lib/queue";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

export class ListQueues extends SqsCommand {
  async exec() {
    const { list, nextToken } = Queue.listQueues({ limit: Number(this.reqBody.MaxResults), prefix: this.reqBody.QueueNamePrefix, token: this.reqBody.NextToken });

    this.res.end(this.#createResponse(list, nextToken));
  }

  #createResponse(QueueUrls: any[], NextToken?: string) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ QueueUrls, NextToken });
    }

    let ListQueuesResult = `<ListQueuesResult>\n`;
    ListQueuesResult += QueueUrls.map((x) => `<QueueUrl>${x}</QueueUrl>`).join("\n");

    if (NextToken) {
      ListQueuesResult += `<NextToken>${NextToken}</NextToken>\n`;
    }

    ListQueuesResult += "</ListQueuesResult>";
    let body = `${xmlVersion}
      <ListQueuesResponse ${xmlns}>
          ${ListQueuesResult}
          ${ResponseMetadata(this.RequestId)}
      </ListQueuesResponse> `;

    return body;
  }
}
