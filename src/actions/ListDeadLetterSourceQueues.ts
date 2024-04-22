import { SqsCommand } from "./sqsCommand";
import { InvalidParameterValueException } from "../common/errors";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import type { Queue } from "../lib/queue";
import { MAX_MaxResults, MIN_MaxResults } from "../common/constants";

export class ListDeadLetterSourceQueues extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.#setBody();

    const { NextToken, MaxResults } = this.body;

    if ("MaxResults" in this.body) {
      if (MaxResults < MIN_MaxResults || MaxResults > MAX_MaxResults) {
        throw new InvalidParameterValueException(`Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.`);
      }
    }

    const result = this.foundQueue!.listDeadLetterSourceQueues({ NextToken, MaxResults });

    this.res.end(this.#createResponse(result));
  }

  #setBody() {
    const body: any = {};
    if ("NextToken" in this.reqBody) {
      body.NextToken = this.reqBody.NextToken;
    }

    if ("MaxResults" in this.reqBody) {
      const MaxResults = this.reqBody.MaxResults;

      if (this.isJsonProtocol) {
        if (MaxResults !== null && MaxResults != 0) {
          if (typeof MaxResults == "number") {
            body.MaxResults = MaxResults;
          } else {
            throw new InvalidParameterValueException(`Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.`);
          }
        }
      } else {
        const IntMaxResults = Number(MaxResults);

        if (IntMaxResults != 0) {
          body.MaxResults = IntMaxResults;
        }
      }
    }

    this.body = body;
  }
  #createResponse(result: ReturnType<Queue["listDeadLetterSourceQueues"]>) {
    if (this.isJsonProtocol) {
      return JSON.stringify(result);
    }

    let body = `${xmlVersion}<ListDeadLetterSourceQueuesResponse ${xmlns}>`;

    if (result.queueUrls) {
      body += "<ListDeadLetterSourceQueuesResult>";

      body += result.queueUrls.map((x) => `<QueueUrl>${x}</QueueUrl>`).join("");

      if (result.NextToken) {
        body += `<NextToken>${result.NextToken}</NextToken>`;
      }
      body += "</ListDeadLetterSourceQueuesResult>";
    } else {
      body += "<ListDeadLetterSourceQueuesResult/>";
    }

    body += `${ResponseMetadata(this.RequestId)}
    </ListDeadLetterSourceQueuesResponse>`;

    return body;
  }
}
