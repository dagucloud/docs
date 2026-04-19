# Licensing

Dagu source code is distributed under the GNU General Public License version 3 or later (`GPL-3.0-or-later`). The repository license file is the public license for the source code.

This page does not relicense any source file. Files that currently carry `SPDX-License-Identifier: GPL-3.0-or-later` remain GPL-licensed unless a separate written agreement says otherwise.

## Embedded Go API

The Go package `github.com/dagucloud/dagu` exposes an experimental embedded API. Applications that import or link this package and distribute the resulting binary should evaluate GPL obligations for the combined work.

For proprietary products that need to distribute Dagu as part of a non-GPL application, contact `contact@dagu.cloud` to discuss a separate commercial embedding license.

Commercial embedding rights are not granted by the public repository, this page, or the public GPL license. They require a separate written agreement with the copyright holder or authorized licensor.

## Public GPL Use

Under the public GPL license, users may use, modify, and distribute Dagu under the GPL terms. The GPL permits commercial activity, including selling copies or services, but distribution must comply with GPL obligations.

Using the Dagu CLI or server as a separate program is different from importing the embedded Go API into another distributed binary. Projects embedding Dagu should review their distribution model and license obligations.

## Commercial License Boundary

The commercial embedding boundary has not been finalized in source form. Before any broader relicensing or public dual-license grant, the project should complete:

- an import-graph audit for the embedded API;
- a contributor-rights review for files in that import graph;
- a third-party dependency license review;
- a written definition of what commercial embedding rights include.

Future source-code license changes should not be inferred from this page.
