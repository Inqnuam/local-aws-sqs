import { InvalidParameterValueException, SqsError } from "../common/errors";
import type { Queue } from "./queue";

export class SqsService {
  REGION = "us-east-1";
  ACCOUNT_ID = "123456789012";
  PORT = 0;
  HOSTNAME = "localhost";
  Queues: Queue[] = [];
  BASE_URL: string = "/";
  validateDlqDestination = true;
  emulateLazyQueues = false;
  emulateQueueCreationLifecycle = true;
  deletingQueues: Set<string> = new Set();

  resetAll() {
    for (const q of this.Queues) {
      q.clearRecords();
    }
    this.Queues = [];
    this.deletingQueues.clear();
  }

  listQueues = ({ prefix, limit, token }: { prefix?: string; limit?: number; token?: string }) => {
    let previousStartPosition = 0;
    if (token) {
      if (!limit) {
        throw new InvalidParameterValueException("MaxResults is a mandatory parameter when you provide a value for NextToken.");
      }

      try {
        const parsedToken = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
        previousStartPosition = parsedToken.previousStartPosition;

        if (parsedToken.previousPrefix && (parsedToken.previousPrefix != prefix || !prefix)) {
          throw new InvalidParameterValueException("Invalid NextToken value. If you are passing in NextToken, you must not change the other request parameters.");
        }
      } catch (error) {
        if (error instanceof SqsError) {
          throw error;
        } else {
          throw new InvalidParameterValueException("Invalid NextToken value.");
        }
      }
    }

    let list = typeof prefix == "string" ? this.Queues.filter((x) => x.QueueName.startsWith(prefix)) : this.Queues;

    let nextToken: any;
    if (limit) {
      if (limit > 1000 || limit < 1) {
        throw new InvalidParameterValueException("Value for parameter MaxResults is invalid. Reason: MaxResults must be an integer between 1 and 1000.");
      }

      const listLength = list.length;
      list = list.slice().splice(previousStartPosition, limit);

      if (previousStartPosition + limit < listLength) {
        nextToken = {
          previousStartPosition: previousStartPosition + limit,
          previousPrefix: prefix,
          date: Date.now(),
        };
      }
    }

    if (list.length > 1000) {
      list = list.slice().splice(0, 1000);

      if (nextToken) {
        nextToken.previousStartPosition = nextToken.previousStartPosition - limit! + 1000;
      } else {
        nextToken = {
          previousStartPosition: previousStartPosition + 1000,
          previousPrefix: prefix,
          date: Date.now(),
        };
      }
    }

    if (nextToken) {
      nextToken = Buffer.from(JSON.stringify(nextToken)).toString("base64");
    }
    return {
      list: list.map((x) => x.QueueUrl),
      nextToken,
    };
  };
}
