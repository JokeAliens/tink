/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {SecurityException} from '../exception/security_exception';
import * as KeyManager from '../internal/key_manager';
import {PbEcdsaParams, PbEcdsaPublicKey, PbKeyData, PbMessage} from '../internal/proto';
import * as Util from '../internal/util';
import * as ecdsaVerify from '../subtle/ecdsa_verify';

import * as EcdsaUtil from './ecdsa_util';
import {PublicKeyVerify} from './internal/public_key_verify';

/**
 * @final
 */
class EcdsaPublicKeyFactory implements KeyManager.KeyFactory {
  /** @override */
  newKey(keyFormat: AnyDuringMigration): never {
    throw new SecurityException(
        'This operation is not supported for public keys. ' +
        'Use EcdsaPrivateKeyManager to generate new keys.');
  }

  /** @override */
  newKeyData(serializedKeyFormat: AnyDuringMigration): never {
    throw new SecurityException(
        'This operation is not supported for public keys. ' +
        'Use EcdsaPrivateKeyManager to generate new keys.');
  }
}

/**
 * @final
 */
export class EcdsaPublicKeyManager implements
    KeyManager.KeyManager<PublicKeyVerify> {
  static KEY_TYPE: string =
      'type.googleapis.com/google.crypto.tink.EcdsaPublicKey';
  private static readonly SUPPORTED_PRIMITIVE_: AnyDuringMigration =
      PublicKeyVerify;
  static VERSION: number = 0;
  keyFactory: AnyDuringMigration;

  constructor() {
    this.keyFactory = new EcdsaPublicKeyFactory();
  }

  /** @override */
  async getPrimitive(
      primitiveType: AnyDuringMigration, key: AnyDuringMigration) {
    if (primitiveType !== this.getPrimitiveType()) {
      throw new SecurityException(
          'Requested primitive type which is not ' +
          'supported by this key manager.');
    }
    const keyProto = EcdsaPublicKeyManager.getKeyProto_(key);
    EcdsaUtil.validatePublicKey(keyProto, this.getVersion());
    const jwk = EcdsaUtil.getJsonWebKeyFromProto(keyProto);
    const params = (keyProto.getParams() as PbEcdsaParams);
    const hash = Util.hashTypeProtoToString(params.getHashType());
    const encoding = EcdsaUtil.encodingTypeProtoToEnum(params.getEncoding());
    return ecdsaVerify.fromJsonWebKey(jwk, hash, encoding);
  }

  /** @override */
  doesSupport(keyType: AnyDuringMigration) {
    return keyType === this.getKeyType();
  }

  /** @override */
  getKeyType() {
    return EcdsaPublicKeyManager.KEY_TYPE;
  }

  /** @override */
  getPrimitiveType() {
    return EcdsaPublicKeyManager.SUPPORTED_PRIMITIVE_;
  }

  /** @override */
  getVersion() {
    return EcdsaPublicKeyManager.VERSION;
  }

  /** @override */
  getKeyFactory() {
    return this.keyFactory;
  }

  private static getKeyProto_(keyMaterial: PbKeyData|
                              PbMessage): PbEcdsaPublicKey {
    if (keyMaterial instanceof PbKeyData) {
      return EcdsaPublicKeyManager.getKeyProtoFromKeyData_(keyMaterial);
    }
    if (keyMaterial instanceof PbEcdsaPublicKey) {
      return keyMaterial;
    }
    throw new SecurityException(
        'Key type is not supported. This key manager supports ' +
        EcdsaPublicKeyManager.KEY_TYPE + '.');
  }

  private static getKeyProtoFromKeyData_(keyData: PbKeyData): PbEcdsaPublicKey {
    if (keyData.getTypeUrl() !== EcdsaPublicKeyManager.KEY_TYPE) {
      throw new SecurityException(
          'Key type ' + keyData.getTypeUrl() + ' is not supported. This key ' +
          'manager supports ' + EcdsaPublicKeyManager.KEY_TYPE + '.');
    }
    let key: PbEcdsaPublicKey;
    try {
      key = PbEcdsaPublicKey.deserializeBinary(keyData.getValue());
    } catch (e) {
      throw new SecurityException(
          'Input cannot be parsed as ' + EcdsaPublicKeyManager.KEY_TYPE +
          ' key-proto.');
    }
    if (!key.getParams() || !key.getX() || !key.getY()) {
      throw new SecurityException(
          'Input cannot be parsed as ' + EcdsaPublicKeyManager.KEY_TYPE +
          ' key-proto.');
    }
    return key;
  }
}
