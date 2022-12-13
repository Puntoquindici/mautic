# LUCA MAUTIC NOTES
docker docs: https://hub.docker.com/r/mautic/mautic

1. clone mautic main repo
```bash
git clone https://github.com/mautic/mautic.git
git checkout tags/4.4.3
docker pull composer
```

2. clone mautic docker
```
git clone https://github.com/mautic/docker-mautic
git checkout mautic4
```

3. patch mautic docker
- php 8.1
- use volume instead of using zip

4. build 
```bash
docker build . -t mautic-v4-php8.1-fpm-volume-nginx -f fpm/Dockerfile
```

5. run
```
docker compose up
```
6. Clear
docker compose down -v

# Theme 
See `themes/mars`.
Patched editor grapesjs:
plugins/GrapesJsBuilderBundle/Assets/library/js/builder.service.js
You need to build it:
```
# from
cd plugins/GrapesJsBuilderBundle
npm i
# dev
npm run build-dev
# prod
npm run build
```

# Rsync
We need to sync:
- theme
- (compiled) grapejs
```
# watch the / 
# --dry-run

rsync --dry-run -vrc -og --chown=www-data:www-data mautic/themes/mars/ root@mautic.puntoquindici.it:/var/www/html/themes/mars/

rsync --dry-run -vrc -og --chown=www-data:www-data mautic/plugins/GrapesJsBuilderBundle/Assets/library/js/ root@mautic.puntoquindici.it:/var/www/html/plugins/GrapesJsBuilderBundle/Assets/library/js/

# (may come handy for other directories) 
# --exclude .github
```



4. run
TODO: move this to docker-compose.yml
TODO: add nginx
```bash
docker network create mauticnet

docker run --name mautic_db -d \
    --restart=always \
    -p 3306:3306 \
    -e MYSQL_ROOT_PASSWORD=mauticDbPwd \
    -v mysql_data:/var/lib/mysql \
    --net=mauticnet \
    percona/percona-server:5.7 \
     --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci

docker run --name mautic -d \
    -e MAUTIC_DB_HOST=mautic_db \
    -e MAUTIC_DB_USER=root \
    -e MAUTIC_DB_PASSWORD=mauticDbPwd \
    -e MAUTIC_DB_NAME=mautic \
    -e MAUTIC_RUN_CRON_JOBS=true \
    -p 8082:80 \
    --net=mauticnet \
    -v /Users/luca/Documents/MARS/code/mautic/mautic:/var/www/html \
    mautic-local

```

# GrapesJS
Per modificare i blocchi:
- clonare https://github.com/artf/grapesjs-preset-newsletter
- aggiornare "node-sass": "^6.0.1" nel package.json
- npm i
- npm link  -> crea link
- modificare (e.g. blocks.js)
- npm run build

Nel repo mautic/mautic
- npm link grapesjs-preset-newsletter # -> crea un link al repo locale
- npm ls -g --depth=0 --link=true # -> verifica che il link sia creato
- cd plugins/GrapesJsBuilderBundle
- Vedi anche builder.service.js ~ L 226 `this.editor.BlockManager.get('button').set({`. Si potrebbe anche fare tutto qui.
- npm run build
- prova mautic

## Plugin
Potrebbe essere necessario attivare il plugin:
- Go to Mautic Settings > Click the cogwheel on the right-hand top corner
- Open the Plugins Directory > click "Plugins" inside the menu
- Find the GrapesJs Plugin and click it > Click "Yes" and then "Save and Close"
- Clear the cache and reload the page (you may also need to clear your browser cache)



## Reference
- Components: https://grapesjs.com/docs/modules/Components.html#how-components-work
- https://github.com/artf/grapesjs-preset-newsletter
  
- https://github.com/artf/grapesjs
  
Mautic usa una serie di "wrapper" ma sembrano apparentemente inutili... per lo meno per i fix ai componenti
- https://github.com/mautic/plugin-grapesjs-builder
- https://github.com/mautic/grapesjs-preset-mautic
- https://github.com/artf/grapesjs-cli

# MAUTIC
User: admin
Password: Admin123


# Backup
From mautic.puntoquindici.it
```
# from /var/www
tar -czf mautic-bkp-4.1/html.tgz html/

# from /var/www/mautic-bkp-4.1
mysqldump -u mautic_usr -p mautic | gzip > db.gz
```

# Restore backup
Local config saved in `app/config/local.php`
Modify:
```
'site_url' => 'http://mautic.localhost:8000/',


'trusted_hosts' => array(
  '0' => '.*\\.?myarstudio.cloud',
  '1' => '.*\\.?puntoquindici.it',
  '2' => '.*\\.?mautic.localhost'
),

```
Restore DB:
```
zcat db.gz | mysql -u root -p mautic
```


**Pulire la cache dopo aver fatto modifiche al config**
```
# From mautic folder:
rm -rf var/cache/*
```

Logs saved in `<mautic_dir>/var/logs`, file php con data del giorno.



# REFERENCE

## Docker
### CLI
```
# ORDER MATTERS
docker container exec -it mautic /bin/bash
#                     ^^^
```

### Attach VSCode to container
https://code.visualstudio.com/docs/remote/containers
https://code.visualstudio.com/docs/remote/containers-tutorial
https://code.visualstudio.com/docs/remote/attach-container


# Mautic Backup and migration
Guide: https://outergain.com/how-to-move-mautic-to-another-server/

NOTA: su mautic.puntoquindici.it viene usato MariaDB. Fa uso di virtual/generated columns e il dump non è importabile su percona-server. 

Usando MariaDB anche in locale funziona.
Aggiornare il file `app/config/local.php` (e.g. site_url).
Pulizia cache (va fatta ad ogni modifica del config):
```sh
 rm -rf var/cache/*
 ```

# History
2022.08.x 

2022.08.17
  - Tentato di far funzionare in locale il backup di codice e db di mautic.puntoquindici.it. Creato dockerfile con dipendenze php derivato dalla configurazione Apache di mautic-docker. Problema con MariaDB (mautic.puntoquindici.it) vs Percona-server (consigliato nel mautic-docker).
2022.08.18 
  - Ripristinato backup e codice di mautic.puntoquindici.it in locale. Va usato MariaDB. Aggiornato config e pulita cache. Funziona.
  - Aggiornamento in locale a Mautic 4.4.1 da commandline. Funziona. https://docs.mautic.org/en/setup/how-to-update-mautic/updating-at-command-line
```
php bin/console mautic:update:find
php bin/console mautic:update:apply
php bin/console mautic:update:apply --finish
# + clean cache
```
  - Aggiornamento su mautic.puntoquindici.it a 4.4.1. Funziona.
  - 
