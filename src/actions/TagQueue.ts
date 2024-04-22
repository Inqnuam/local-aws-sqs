import { SqsCommand } from "./sqsCommand";
import { MissingParameterException, InvalidParameterValueException, SqsError } from "../common/errors";
import { isJsObject } from "../common/utils";
import { TAG_KEY_PATTERN, TAG_KEY_ERR_MSG } from "../common/constants";
import { ResponseMetadata, xmlVersion, xmlns } from "../common/responses";

const MalformedInput = new SqsError({
  Code: "MalformedInput",
  Type: "com.amazon.coral.service#SerializationException",
  Message: "Start of structure or map found where not expected.",
});

export class TagQueue extends SqsCommand {
  async exec() {
    this.verifyExistingQueue();
    this.verifyTagQueue();

    this.foundQueue!.setTags(this.body.Tags);

    this.res.end(this.#createResponse());
  }

  #createResponse() {
    if (this.isJsonProtocol) {
      return;
    }

    return `${xmlVersion}<TagQueueResponse ${xmlns}>
  ${ResponseMetadata(this.RequestId)}
</TagQueueResponse>`;
  }

  verifyTagQueue = () => {
    const tags = this.isJsonProtocol ? this.reqBody.Tags : this.reqBody.Tag;
    if (typeof tags == "undefined") {
      throw new MissingParameterException("The request must contain the parameter Tags.");
    }

    if (this.isJsonProtocol) {
      if (!isJsObject(tags)) {
        throw MalformedInput;
      }

      if (Object.values(tags).find((x) => typeof x != "string")) {
        throw MalformedInput;
      }
    } else if (!Array.isArray(tags)) {
      throw new InvalidParameterValueException("The request must contain the parameter Tags.");
    }

    let Tags = [];

    if (this.isJsonProtocol) {
      Object.keys(this.reqBody.Tags).forEach((Key) => {
        Tags.push({ Key, Value: this.reqBody.Tags[Key] });
      });
    } else {
      Tags = this.reqBody.Tag;
    }

    if (Tags.some((x: { Key: string }) => x.Key.length < 1 || x.Key.length > 128)) {
      throw new InvalidParameterValueException("Tag keys must be between 1 and 128 characters in length.");
    }

    if (Tags.some((x: any) => !TAG_KEY_PATTERN.test(x.Key))) {
      throw new InvalidParameterValueException(TAG_KEY_ERR_MSG);
    }

    this.body = { Tags };
  };
}
