# Install

## With HACS

1. Open **HACS** and search for **Easy Sidebar Pro**, then choose **Download**.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration → Easy Sidebar Pro**.
4. Refresh the browser, and close and reopen the companion app. The pencil appears next to the sidebar title.

No `configuration.yaml` changes are needed.

!!! tip "Not found in the HACS search?"
    Add it as a custom repository: in HACS open the menu (three dots), choose **Custom repositories**, enter `https://github.com/bareli/easy_sidebar_pro`, pick the category **Integration**, and then continue from step 1.

## Manually

Copy the folder `custom_components/easy_sidebar_pro` from the [repository](https://github.com/bareli/easy_sidebar_pro) into `<config>/custom_components/`, restart Home Assistant and continue from step 3 above.

## Coming from Sidebar Organizer

Remove Sidebar Organizer first; running both is not supported. Groups, default collapsed groups, one group open at a time, the collapse all toggle, divider styling and bottom grid items have equivalents here. Sidebar background and scrollbar colours are left to your Home Assistant theme. Bottom groups, custom links with templates and a YAML config file are not supported.

## Removing

Delete the integration and refresh the browser. Home Assistant's own order and hidden panels stay as you last saved them.
