/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SecurityException} from '../exception/security_exception';
import {CryptoFormat} from '../internal/crypto_format';
import * as PrimitiveSet from '../internal/primitive_set';
import {PrimitiveWrapper} from '../internal/primitive_wrapper';
import {PbKeyStatusType} from '../internal/proto';
import * as Validators from '../subtle/validators';

import {PublicKeyVerify} from './internal/public_key_verify';

/**
 * @final
 */
class WrappedPublicKeyVerify implements PublicKeyVerify {
  // The constructor should be @private, but it is not supported by Closure
  // (see https://github.com/google/closure-compiler/issues/2761).
  constructor(private readonly primitiveSet:
                  PrimitiveSet.PrimitiveSet<PublicKeyVerify>) {}

  static newPublicKeyVerify(primitiveSet:
                                PrimitiveSet.PrimitiveSet<PublicKeyVerify>):
      PublicKeyVerify {
    if (!primitiveSet) {
      throw new SecurityException('Primitive set has to be non-null.');
    }
    return new WrappedPublicKeyVerify(primitiveSet);
  }

  /** @override */
  async verify(signature: AnyDuringMigration, data: AnyDuringMigration) {
    Validators.requireUint8Array(signature);
    Validators.requireUint8Array(data);
    if (signature.length > CryptoFormat.NON_RAW_PREFIX_SIZE) {
      const keyId = signature.subarray(0, CryptoFormat.NON_RAW_PREFIX_SIZE);
      const primitives = await this.primitiveSet.getPrimitives(keyId);
      const rawSignature = signature.subarray(
          CryptoFormat.NON_RAW_PREFIX_SIZE, signature.length);
      let isValid: boolean = false;
      try {
        isValid = await this.tryVerification_(primitives, rawSignature, data);
      } catch (e) {
        // Ignored.
      }

      if (isValid) {
        return isValid;
      }
    }
    const primitives = await this.primitiveSet.getRawPrimitives();
    return this.tryVerification_(primitives, signature, data);
  }

  /**
   * Tries to verify the signature using each entry in primitives. It
   * returns false if no entry succeeds.
   *
   *
   */
  private async tryVerification_(
      primitives: Array<PrimitiveSet.Entry<PublicKeyVerify>>,
      signature: Uint8Array, data: Uint8Array): Promise<boolean> {
    const primitivesLength = primitives.length;
    for (let i = 0; i < primitivesLength; i++) {
      if (primitives[i].getKeyStatus() != PbKeyStatusType.ENABLED) {
        continue;
      }
      const primitive = primitives[i].getPrimitive();
      let isValid: boolean;
      try {
        isValid = await primitive.verify(signature, data);
      } catch (e) {
        continue;
      }
      if (isValid) {
        return isValid;
      }
    }
    return false;
  }
}

export class PublicKeyVerifyWrapper implements
    PrimitiveWrapper<PublicKeyVerify> {
  /**
   * @override
   */
  wrap(primitiveSet: AnyDuringMigration) {
    return WrappedPublicKeyVerify.newPublicKeyVerify(primitiveSet);
  }

  /**
   * @override
   */
  getPrimitiveType() {
    return PublicKeyVerify;
  }
}
