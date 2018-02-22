/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import VsCodeTelemetryReporter from 'vscode-extension-telemetry';
import { memoize } from './memoize';

interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export default class TelemetryReporter {
	private _reporter: VsCodeTelemetryReporter | null = null;

	dispose() {
		if (this._reporter) {
			this._reporter.dispose();
			this._reporter = null;
		}
	}

	constructor(
		private readonly clientVersionDelegate: () => string
	) { }

	public logTelemetry(eventName: string, properties?: { [prop: string]: string }) {
		const reporter = this.reporter;
		if (reporter) {
			if (!properties) {
				properties = {};
			}
			properties['version'] = this.clientVersionDelegate();

			reporter.sendTelemetryEvent(eventName, properties);
		}
	}

	@memoize
	private get reporter(): VsCodeTelemetryReporter | null {
		if (this.packageInfo && this.packageInfo.aiKey) {
			this._reporter = new VsCodeTelemetryReporter(
				this.packageInfo.name,
				this.packageInfo.version,
				this.packageInfo.aiKey);
			return this._reporter;
		}
		return null;
	}

	@memoize
	private get packageInfo(): IPackageInfo | null {
		const packagePath = path.join(__dirname, '..', '..', 'package.json');
		const extensionPackage = require(packagePath);
		if (extensionPackage) {
			return {
				name: extensionPackage.name,
				version: extensionPackage.version,
				aiKey: extensionPackage.aiKey
			};
		}
		return null;
	}
}