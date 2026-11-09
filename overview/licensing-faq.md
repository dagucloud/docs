# Licensing FAQ

This page answers common questions from teams that run Dagu themselves or deliver it to customers. It is general information and not legal advice. Ask your own counsel about your situation.

Dagu's source code is licensed under `GPL-3.0-or-later`. A paid license unlocks product features under the [Terms of Service](https://dagu.sh/terms). It does not change anyone's obligations under the GPL.

## Running Dagu in your organization

**Do we have to publish anything if we only run Dagu internally?**

No. The GPL's source-code obligations apply when you convey copies to others. Running Dagu yourself, including a modified version, is not conveying (GPLv3 section 2).

**Do our workflows and scripts become GPL?**

Workflow YAML, scripts, and programs that Dagu starts are separate programs that run as separate processes. Having Dagu run them does not by itself place them under the GPL.

**Can a contractor operate Dagu for us?**

Yes. GPLv3 section 2 lets you give copies to others so that they run the software or modify it exclusively on your behalf, without that counting as conveying.

## Delivering Dagu to a customer

**Can we sell a system or service that includes Dagu?**

Yes. The GPL permits charging for copies and for services.

**What must we hand over with an unmodified Dagu?**

- A copy of the GPL, which is the `LICENSE` file in the release.
- The corresponding source for the exact version you deliver, by one of the methods in GPLv3 section 6.

The simplest method is to include the source archive of that release tag in the delivery. If you point to a server instead, you are responsible for keeping that source available for as long as section 6 requires.

**What if we modified Dagu?**

The modified version must be licensed under the GPL to the customer you deliver it to, must carry notices that you changed it and when, and must come with its corresponding source (GPLv3 sections 5 and 6). You do not have to publish it to anyone else.

**Can our contract stop the customer from redistributing Dagu?**

No. You cannot impose further restrictions on the rights the GPL grants (GPLv3 section 10). Your contract can cover your own separate software and services.

**Does delivering our own batch jobs alongside Dagu put them under the GPL?**

Separate programs delivered together on the same medium are an aggregate, and the GPL does not extend to the other parts (GPLv3 section 5). This changes if your code is combined with Dagu into one program.

## Embedding Dagu in a product

**Can we import Dagu's Go package into a proprietary product we distribute?**

Not under the public license alone. An application that imports the package and is distributed forms a combined work subject to the GPL. Distributing it as non-GPL software needs a separate commercial agreement. See [Embedding Licensing](/embedding/licensing).

## Questions

Write to `company@descarty.com` about commercial terms.
