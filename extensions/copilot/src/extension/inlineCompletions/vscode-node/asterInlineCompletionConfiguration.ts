/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConfigurationChangeEvent } from 'vscode';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';

export const ASTER_INLINE_COMPLETIONS_SETTING_PREFIX = 'aster.ai.inlineCompletions';

export function getAsterInlineCompletionsEnabled(configurationService: IConfigurationService): boolean {
	const aliasValue = getConfiguredAsterInlineCompletionsAlias(configurationService, 'enabled');
	if (typeof aliasValue === 'boolean') {
		return aliasValue;
	}
	return configurationService.getConfig(ConfigKey.AsterInlineCompletionsEnabled);
}

export function getAsterInlineCompletionsVendor(configurationService: IConfigurationService): string {
	return getAsterInlineCompletionsStringConfig(configurationService, 'vendor', ConfigKey.AsterInlineCompletionsVendor);
}

export function getAsterInlineCompletionsModelId(configurationService: IConfigurationService): string {
	return getAsterInlineCompletionsStringConfig(configurationService, 'modelId', ConfigKey.AsterInlineCompletionsModelId);
}

export function isAsterInlineCompletionsConfigurationChange(event: ConfigurationChangeEvent): boolean {
	return event.affectsConfiguration('github.copilot.aster.inlineCompletions')
		|| event.affectsConfiguration(ASTER_INLINE_COMPLETIONS_SETTING_PREFIX);
}

function getAsterInlineCompletionsStringConfig(
	configurationService: IConfigurationService,
	aliasKey: string,
	legacyKey: typeof ConfigKey.AsterInlineCompletionsVendor | typeof ConfigKey.AsterInlineCompletionsModelId
): string {
	const aliasValue = getConfiguredAsterInlineCompletionsAlias(configurationService, aliasKey);
	if (typeof aliasValue === 'string') {
		return aliasValue;
	}
	return configurationService.getConfig(legacyKey);
}

function getConfiguredAsterInlineCompletionsAlias(
	configurationService: IConfigurationService,
	aliasKey: string
): unknown {
	const inspected = configurationService.inspectNonExtensionConfig<unknown>(`${ASTER_INLINE_COMPLETIONS_SETTING_PREFIX}.${aliasKey}`);
	return inspected?.workspaceFolderValue
		?? inspected?.workspaceValue
		?? inspected?.globalValue
		?? inspected?.workspaceFolderLanguageValue
		?? inspected?.workspaceLanguageValue
		?? inspected?.globalLanguageValue;
}
