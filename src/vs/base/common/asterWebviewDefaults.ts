/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const defaultAsterWebviewResourceBaseHost = 'aster-webview.invalid';

export const defaultAsterWebviewContentExternalBaseUrlTemplate = `https://{{uuid}}.${defaultAsterWebviewResourceBaseHost}/{{quality}}/{{commit}}/out/vs/workbench/contrib/webview/browser/pre/`;

export const defaultAsterWebviewFrameSource = `https://*.${defaultAsterWebviewResourceBaseHost}`;
