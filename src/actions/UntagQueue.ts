import { SqsCommand } from "./sqsCommand";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";
import { TAG_KEY_PATTERN, TAG_KEY_ERR_MSG } from "../common/constants";
import { InvalidParameterValueException, MissingParameterException } from "../common/errors";

export class UntagQueue extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.verifyRequest();
    this.foundQueue!.removeTags(this.body.tags);

    this.res.end(this.#createResponse());
  }

  verifyRequest() {
    const fieldName = this.isJsonProtocol ? "TagKeys" : "TagKey";
    const tags = this.reqBody[fieldName];

    if (!Array.isArray(tags) || tags.some((x) => x.startsWith("[object"))) {
      throw new InvalidParameterValueException(`${fieldName} must be an array of string`);
    }

    if (!tags.length) {
      new MissingParameterException("The request must contain the parameter TagKeys.");
    }

    if (tags.some((x: string) => x.length < 1 || x.length > 128)) {
      throw new InvalidParameterValueException("Tag keys must be between 1 and 128 characters in length.");
    }

    if (tags.some((x) => !TAG_KEY_PATTERN.test(x))) {
      throw new InvalidParameterValueException(TAG_KEY_ERR_MSG);
    }

    this.body = { tags };
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<UntagQueueResponse ${xmlns}>
    ${ResponseMetadata(this.RequestId)}
  </UntagQueueResponse>`;
  }
}
