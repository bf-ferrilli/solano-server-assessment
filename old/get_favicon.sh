#!/bin/bash
# Fetch the page, extract the favicon URL, then download it
favicon_url=$(curl -s "https://welcome.solano.edu/" | grep -oP '(?<=<img id="preview-favicon" src=")[^"]+')
[ -n "$favicon_url" ] && curl -O "$favicon_url"
