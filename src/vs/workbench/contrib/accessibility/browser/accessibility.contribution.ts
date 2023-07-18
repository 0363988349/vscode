/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { AccessibilityHelpNLS } from 'vs/editor/common/standaloneStrings';
import { ToggleTabFocusModeAction } from 'vs/editor/contrib/toggleTabFocusMode/browser/toggleTabFocusMode';
import { localize } from 'vs/nls';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { AccessibilityHelpAction, AccessibleViewAction, AccessibleViewNextAction, AccessibleViewPreviousAction, registerAccessibilityConfiguration } from 'vs/workbench/contrib/accessibility/browser/accessibilityContribution';
import * as strings from 'vs/base/common/strings';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { NEW_UNTITLED_FILE_COMMAND_ID } from 'vs/workbench/contrib/files/browser/fileConstants';
import { ModesHoverController } from 'vs/editor/contrib/hover/browser/hover';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { getNotificationFromContext } from 'vs/workbench/browser/parts/notifications/notificationsCommands';
import { IListService, WorkbenchList } from 'vs/platform/list/browser/listService';
import { NotificationFocusedContext } from 'vs/workbench/common/contextkeys';
import { IAccessibleViewService, AccessibleViewService, IAccessibleContentProvider, IAccessibleViewOptions, AccessibleViewType, accessibleViewIsShown } from 'vs/workbench/contrib/accessibility/browser/accessibleView';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

registerAccessibilityConfiguration();
registerSingleton(IAccessibleViewService, AccessibleViewService, InstantiationType.Delayed);

class AccessibilityHelpProvider implements IAccessibleContentProvider {
	onClose() {
		this._editor.focus();
	}
	options: IAccessibleViewOptions = { type: AccessibleViewType.HelpMenu, ariaLabel: localize('editor-help', "editor accessibility help"), readMoreUrl: 'https://go.microsoft.com/fwlink/?linkid=851010' };
	verbositySettingKey: string = 'editor';
	constructor(
		private readonly _editor: ICodeEditor,
		@IKeybindingService private readonly _keybindingService: IKeybindingService
	) {
	}

	private _descriptionForCommand(commandId: string, msg: string, noKbMsg: string): string {
		const kb = this._keybindingService.lookupKeybinding(commandId);
		if (kb) {
			return strings.format(msg, kb.getAriaLabel());
		}
		return strings.format(noKbMsg, commandId);
	}

	provideContent(): string {
		const options = this._editor.getOptions();
		const content = [];

		if (options.get(EditorOption.inDiffEditor)) {
			if (options.get(EditorOption.readOnly)) {
				content.push(AccessibilityHelpNLS.readonlyDiffEditor);
			} else {
				content.push(AccessibilityHelpNLS.editableDiffEditor);
			}
		} else {
			if (options.get(EditorOption.readOnly)) {
				content.push(AccessibilityHelpNLS.readonlyEditor);
			} else {
				content.push(AccessibilityHelpNLS.editableEditor);
			}
		}

		if (options.get(EditorOption.tabFocusMode)) {
			content.push(this._descriptionForCommand(ToggleTabFocusModeAction.ID, AccessibilityHelpNLS.tabFocusModeOnMsg, AccessibilityHelpNLS.tabFocusModeOnMsgNoKb));
		} else {
			content.push(this._descriptionForCommand(ToggleTabFocusModeAction.ID, AccessibilityHelpNLS.tabFocusModeOffMsg, AccessibilityHelpNLS.tabFocusModeOffMsgNoKb));
		}
		return content.join('\n');
	}
}

class EditorAccessibilityHelpContribution extends Disposable {
	static ID: 'editorAccessibilityHelpContribution';
	constructor() {
		super();
		this._register(AccessibilityHelpAction.addImplementation(95, 'editor', async accessor => {
			const codeEditorService = accessor.get(ICodeEditorService);
			const accessibleViewService = accessor.get(IAccessibleViewService);
			const instantiationService = accessor.get(IInstantiationService);
			const commandService = accessor.get(ICommandService);
			let codeEditor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();
			if (!codeEditor) {
				await commandService.executeCommand(NEW_UNTITLED_FILE_COMMAND_ID);
				codeEditor = codeEditorService.getActiveCodeEditor()!;
			}
			accessibleViewService.show(instantiationService.createInstance(AccessibilityHelpProvider, codeEditor));
		}));
	}
}

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(EditorAccessibilityHelpContribution, LifecyclePhase.Eventually);



class HoverAccessibleViewContribution extends Disposable {
	static ID: 'hoverAccessibleViewContribution';
	private _options: IAccessibleViewOptions = {
		ariaLabel: localize('hoverAccessibleView', "Hover Accessible View"), language: 'typescript', type: AccessibleViewType.View
	};
	constructor() {
		super();
		this._register(AccessibleViewAction.addImplementation(95, 'hover', accessor => {
			const accessibleViewService = accessor.get(IAccessibleViewService);
			const codeEditorService = accessor.get(ICodeEditorService);
			const editor = codeEditorService.getActiveCodeEditor() || codeEditorService.getFocusedCodeEditor();
			const editorHoverContent = editor ? ModesHoverController.get(editor)?.getWidgetContent() ?? undefined : undefined;
			if (!editorHoverContent) {
				return false;
			}
			accessibleViewService.show({
				verbositySettingKey: 'hover',
				provideContent() { return editorHoverContent; },
				onClose() { },
				options: this._options
			});
			return true;
		}, EditorContextKeys.hoverFocused));
		this._register(AccessibleViewAction.addImplementation(90, 'extension-hover', accessor => {
			const accessibleViewService = accessor.get(IAccessibleViewService);
			const contextViewService = accessor.get(IContextViewService);
			const contextViewElement = contextViewService.getContextViewElement();
			const extensionHoverContent = contextViewElement?.textContent ?? undefined;
			if (contextViewElement.classList.contains('accessible-view-container') || !extensionHoverContent) {
				// The accessible view, itself, uses the context view service to display the text. We don't want to read that.
				return false;
			}
			accessibleViewService.show({
				verbositySettingKey: 'hover',
				provideContent() { return extensionHoverContent; },
				onClose() { },
				options: this._options
			});
			return true;
		}));
	}
}

const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(HoverAccessibleViewContribution, LifecyclePhase.Eventually);


class NotificationAccessibleViewContribution extends Disposable {
	static ID: 'notificationAccessibleViewContribution';
	renderAccessibleView(accessor: ServicesAccessor, notificationIndex: number | undefined): boolean {
		const accessibleViewService = accessor.get(IAccessibleViewService);
		const listService = accessor.get(IListService);
		const commandService = accessor.get(ICommandService);
		const notification = getNotificationFromContext(listService);
		if (!notification) {
			return false;
		}
		const list = listService.lastFocusedList;
		commandService.executeCommand('notifications.showList');
		if (!notificationIndex && list instanceof WorkbenchList) {
			notificationIndex = list.indexOf(notification);
			console.log('notification index', notificationIndex);
		}
		if (notificationIndex === undefined) {
			return false;
		}
		function focusList(): void {
			commandService.executeCommand('notifications.showList');
			if (list && notificationIndex !== undefined) {
				list.domFocus();
				try {
					list.setFocus([notificationIndex]);
				} catch { }
			}
		}
		const message = notification.message.original.toString();
		if (!message) {
			return false;
		}
		accessibleViewService.show({
			provideContent: () => {
				console.log('providing content', message);
				return localize('notification.accessibleView', '{0} Source: {1}', message, notification!.source);
			},
			onClose(): void {
				focusList();
			},
			verbositySettingKey: 'notifications',
			options: {
				ariaLabel: localize('notification', "Notification Accessible View"),
				type: AccessibleViewType.View
			}
		});
		focusList();
		return true;
	}
	constructor() {
		super();
		this._register(AccessibleViewAction.addImplementation(90, 'notifications', accessor => {
			return this.renderAccessibleView(accessor, undefined);
		}, ContextKeyExpr.or(NotificationFocusedContext, accessibleViewIsShown)));
		this._register(AccessibleViewNextAction.addImplementation(90, 'notifications', accessor => {
			const listService = accessor.get(IListService);
			const list = listService.lastFocusedList;
			if (!list) {
				return false;
			}
			list.domFocus();
			list.focusNext();

			const notificationIndex = list instanceof WorkbenchList ? list.getFocus()[0] ?? undefined : undefined;
			return this.renderAccessibleView(accessor, notificationIndex);
		}, accessibleViewIsShown));
		this._register(AccessibleViewPreviousAction.addImplementation(90, 'notifications', accessor => {
			const listService = accessor.get(IListService);
			const list = listService.lastFocusedList;
			if (!list) {
				return false;
			}
			list.domFocus();
			list.focusPrevious();
			const notificationIndex = list instanceof WorkbenchList ? list.getFocus()[0] ?? undefined : undefined;
			return this.renderAccessibleView(accessor, notificationIndex);
		}, accessibleViewIsShown));
	}
}

workbenchContributionsRegistry.registerWorkbenchContribution(NotificationAccessibleViewContribution, LifecyclePhase.Eventually);
