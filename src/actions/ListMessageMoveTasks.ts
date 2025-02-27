import { SqsCommand } from "./sqsCommand";
import { Queue } from "../lib/queue";
import {
  InvalidArnException,
  InvalidParameterValueException,
  MalformedInputException,
  MissingParameterException,
  ResourceNotFoundException,
  throwOnNoPrimitiveType,
} from "../common/errors";
import { getQueueNameFromArn } from "../common/utils";
import type { MessageMoveTask } from "../lib/messageMoveTask";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

const InvalidMaxResults = new InvalidParameterValueException("Value for parameter MaxResults is invalid. Reason: You must enter a number that's between 1 and 10.");

const MIN_MaxResults = 1;
const kMaxResults = 1;
const MAX_MaxResults = 10;

export class ListMessageMoveTasks extends SqsCommand {
  async exec() {
    this.#setBody();

    const { MaxResults } = this.body;

    const Results = this.foundQueue!.listMessageMoveTasks(MaxResults);

    this.res.end(this.#createResponse(Results));
  }

  #setBody() {
    const { SourceArn, MaxResults: maxResults } = this.reqBody;

    throwOnNoPrimitiveType(SourceArn);

    if (SourceArn === null || typeof SourceArn == "undefined") {
      throw new MissingParameterException("The request must contain the parameter SourceArn.");
    }

    if (!SourceArn || !String(SourceArn).startsWith("arn:aws:sqs:")) {
      throw new InvalidArnException("SourceArn");
    }

    const QueueName = getQueueNameFromArn(SourceArn);

    this.foundQueue = this.service.Queues.find((x) => x.QueueName == QueueName);

    if (!this.foundQueue) {
      throw new ResourceNotFoundException("The resource that you specified for the SourceArn parameter doesn't exist.");
    }

    throwOnNoPrimitiveType(maxResults);

    if (typeof maxResults == "boolean") {
      throw new MalformedInputException(`${String(maxResults).toUpperCase()}_VALUE can not be converted to an Integer`);
    }

    let MaxResults: number = kMaxResults;

    if (typeof maxResults != "undefined") {
      if (maxResults === 0) {
        throw InvalidMaxResults;
      }
      if (maxResults !== null && (maxResults == "" || (typeof maxResults == "string" && (maxResults.includes(" ") || isNaN(maxResults.trim() as unknown as number))))) {
        throw new MalformedInputException("STRING_VALUE can not be converted to an Integer");
      }

      MaxResults = Number(maxResults);
      if (MaxResults < MIN_MaxResults || MaxResults > MAX_MaxResults) {
        throw InvalidMaxResults;
      }
    }

    this.body = { MaxResults };
  }

  #createResponse(Results: ReturnType<MessageMoveTask["getState"]>[]) {
    if (this.isJsonProtocol) {
      return JSON.stringify({ Results: Results.length ? Results : undefined });
    }

    let ListMessageMoveTasksResult = "<ListMessageMoveTasksResult";

    if (!Results.length) {
      ListMessageMoveTasksResult += "/>";
    } else {
      ListMessageMoveTasksResult += ">";

      for (const result of Results) {
        ListMessageMoveTasksResult += "<Result>";
        for (const [key, value] of Object.entries(result)) {
          if (typeof value == "undefined") {
            continue;
          }

          ListMessageMoveTasksResult += `<${key}>${value}</${key}>`;
        }

        ListMessageMoveTasksResult += "</Result>";
      }

      ListMessageMoveTasksResult += "</ListMessageMoveTasksResult>";
    }

    return `${xmlVersion}<ListMessageMoveTasksResponse ${xmlns}>
    ${ListMessageMoveTasksResult}
    ${ResponseMetadata(this.RequestId)}
  </ListMessageMoveTasksResponse>`;
  }
}
