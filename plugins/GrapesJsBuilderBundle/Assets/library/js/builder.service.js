import grapesjs from 'grapesjs';
import grapesjsmjml from 'grapesjs-mjml';
import grapesjsnewsletter from 'grapesjs-preset-newsletter';
import grapesjswebpage from 'grapesjs-preset-webpage';
import grapesjspostcss from 'grapesjs-parser-postcss';
import contentService from 'grapesjs-preset-mautic/dist/content.service';
import grapesjsmautic from 'grapesjs-preset-mautic';
import mjmlService from 'grapesjs-preset-mautic/dist/mjml/mjml.service';
import 'grapesjs-plugin-ckeditor';

// for local dev
// import contentService from '../../../../../../grapesjs-preset-mautic/src/content.service';
// import grapesjsmautic from '../../../../../../grapesjs-preset-mautic/src';
// import mjmlService from '../../../../../../grapesjs-preset-mautic/src/mjml/mjml.service';

import CodeModeButton from './codeMode/codeMode.button';

export default class BuilderService {
  editor;

  assets;

  uploadPath;

  deletePath;

  /**
   * @param {*} assets
   */
  constructor(assets) {
    if (!assets.conf.uploadPath) {
      throw Error('No uploadPath found');
    }
    if (!assets.conf.deletePath) {
      throw Error('No deletePath found');
    }
    if (!assets.files || !assets.files[0]) {
      console.warn('no assets');
    }

    this.assets = assets.files;
    this.uploadPath = assets.conf.uploadPath;
    this.deletePath = assets.conf.deletePath;
  }

  /**
   * Initialize GrapesJsBuilder
   *
   * @param object
   */
  setListeners() {
    if (!this.editor) {
      throw Error('No editor found');
    }

    // Why would we not want to keep the history?
    //
    // this.editor.on('load', () => {
    //   const um = this.editor.UndoManager;
    //   // Clear stack of undo/redo
    //   um.clear();
    // });

    const keymaps = this.editor.Keymaps;
    let allKeymaps;

    this.editor.on('modal:open', () => {
      // Save all keyboard shortcuts
      allKeymaps = { ...keymaps.getAll() };

      // Remove keyboard shortcuts to prevent launch behind popup
      keymaps.removeAll();
    });

    this.editor.on('modal:close', () => {
      // ReMap keyboard shortcuts on modal close
      Object.keys(allKeymaps).map((objectKey) => {
        const shortcut = allKeymaps[objectKey];

        keymaps.add(shortcut.id, shortcut.keys, shortcut.handler);
        return keymaps;
      });
    });

    this.editor.on('asset:remove', (response) => {
      // Delete file on server
      mQuery.ajax({
        url: this.deletePath,
        data: { filename: response.getFilename() },
      });
    });
  }

  /**
   * Initialize the grapesjs build in the
   * correct mode
   */
  initGrapesJS(object) {
    // disable mautic global shortcuts
    Mousetrap.reset();
    if (object === 'page') {
      this.editor = this.initPage();
    } else if (object === 'emailform') {
      if (mjmlService.getOriginalContentMjml()) {
        this.editor = this.initEmailMjml();
      } else {
        this.editor = this.initEmailHtml();
      }
    } else {
      throw Error(`Not supported builder type: ${object}`);
    }

    // add code mode button
    // @todo: only show button if configured: sourceEdit: 1,
    const codeModeButton = new CodeModeButton(this.editor);
    codeModeButton.addCommand();
    codeModeButton.addButton();

    this.setListeners();
  }

  static getMauticConf(mode) {
    return {
      mode,
    };
  }

  static getCkeConf() {
    return {
      options: {
        language: 'en',
        toolbar: [
          { name: 'links', items: ['Link', 'Unlink'] },
          { name: 'basicstyles', items: ['Bold', 'Italic', 'Strike', '-', 'RemoveFormat'] },
          { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-'] },
          { name: 'colors', items: ['TextColor', 'BGColor'] },
          { name: 'document', items: ['Source'] },
          { name: 'insert', items: ['SpecialChar'] },
        ],
        extraPlugins: ['sharedspace', 'colorbutton'],
      },
    };
  }

  /**
   * Initialize the builder in the landingapge mode
   */
  initPage() {
    // Launch GrapesJS with body part
    this.editor = grapesjs.init({
      clearOnRender: true,
      container: '.builder-panel',
      components: contentService.getOriginalContentHtml().body.innerHTML,
      height: '100%',
      canvas: {
        styles: contentService.getStyles(),
      },
      storageManager: false, // https://grapesjs.com/docs/modules/Storage.html#basic-configuration
      assetManager: this.getAssetManagerConf(),
      styleManager: {
        clearProperties: true, // Temp fix https://github.com/artf/grapesjs-preset-webpage/issues/27
      },
      plugins: [grapesjswebpage, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        [grapesjswebpage]: {
          formsOpts: false,
        },
        grapesjsmautic: BuilderService.getMauticConf('page-html'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });

    return this.editor;
  }

  initEmailMjml() {
    const components = mjmlService.getOriginalContentMjml();
    // validate
    mjmlService.mjmlToHtml(components);

    this.editor = grapesjs.init({
      clearOnRender: true,
      container: '.builder-panel',
      components,
      height: '100%',
      storageManager: false,
      assetManager: this.getAssetManagerConf(),
      plugins: [grapesjsmjml, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        grapesjsmjml: {},
        grapesjsmautic: BuilderService.getMauticConf('email-mjml'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });

    this.editor.BlockManager.get('mj-button').set({
      content: '<mj-button href="https://">Button</mj-button>',
    });

    return this.editor;
  }

  initEmailHtml() {
    const components = contentService.getOriginalContentHtml().body.innerHTML;
    if (!components) {
      throw new Error('no components');
    }

    // Launch GrapesJS with body part
    this.editor = grapesjs.init({
      clearOnRender: true,
      container: '.builder-panel',
      components,
      height: '100%',
      storageManager: false,
      assetManager: this.getAssetManagerConf(),
      plugins: [grapesjsnewsletter, grapesjspostcss, grapesjsmautic, 'gjs-plugin-ckeditor'],
      pluginsOpts: {
        grapesjsnewsletter: {},
        grapesjsmautic: BuilderService.getMauticConf('email-html'),
        'gjs-plugin-ckeditor': BuilderService.getCkeConf(),
      },
    });

    // add a Mautic custom block Button
    // P15 LUCA : customize editor
    // see repo: grapesjs-preset-newsletter 
    // file src/blocks.js 
    console.log("LUCA P15 MARS modified editor v3")
    // reset all
    // bm.getAll().reset();
    this.editor.BlockManager.get('button').set({
      content: //html
        `<div>
          <a data-gjs-type="link" href="#" target="_blank" class="btn btn-cyan">
              Button Builder
          </a>
        </div>`
    });

    this.editor.BlockManager.get('text').set({
      content:
        '<p class="lucaBuilder" >Insert your text here Luca Builder</p>'
    });

    this.editor.BlockManager.get('text-sect').set({
      content:
      '<h2 class="heading">Insert title here H2</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua</p>'
    });

    this.editor.BlockManager.get('image').set({
      content: //html
      `<img data-gjs-type="image" style="display:block; max-width: 100%; margin: auto; margin-top: 27px; margin-bottom: 27px;" />`
    });
    

    // bm.getAll().reset();
    // bm.add('sect100', {
    //   label: opt.sect100BlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-b1'},
    //   content: `<table style="${tableStyleStr}">
    //     <tr>
    //       <td style="${cellStyleStr}"></td>
    //     </tr>
    //     </table>`,
    // });
    // bm.add('sect50', {
    //   label: opt.sect50BlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-b2'},
    //   content: `<table style="${tableStyleStr}">i
    //     <tr>
    //       <td style="${cellStyleStr} width: 50%"></td>
    //       <td style="${cellStyleStr} width: 50%"></td>
    //     </tr>
    //     </table>`,
    // });
    // bm.add('sect30', {
    //   label: opt.sect30BlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-b3'},
    //   content: `<table style="${tableStyleStr}">
    //     <tr>
    //       <td style="${cellStyleStr} width: 33.3333%"></td>
    //       <td style="${cellStyleStr} width: 33.3333%"></td>
    //       <td style="${cellStyleStr} width: 33.3333%"></td>
    //     </tr>
    //     </table>`,
    // });
    // bm.add('sect37', {
    //   label: opt.sect37BlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-b37'},
    //   content: `<table style="${tableStyleStr}">
    //     <tr>
    //       <td style="${cellStyleStr} width:30%"></td>
    //       <td style="${cellStyleStr} width:70%"></td>
    //     </tr>
    //     </table>`,
    // });
    // bm.add('button', {
    //   label: opt.buttonBlkLabel,
    //   category: opt.categoryLabel,
    //   content: '<a class="btn-cyan">Button</a>',
    //   attributes: {class:'gjs-fonts gjs-f-button'}
    // });
    // bm.add('divider', {
    //   label: opt.dividerBlkLabel,
    //   category: opt.categoryLabel,
    //   content: `<table style="width: 100%; margin-top: 10px; margin-bottom: 10px;">
    //     <tr>
    //       <td class="divider"></td>
    //     </tr>
    //   </table>
    //   <style>
    //   .divider {
    //     background-color: rgba(0, 0, 0, 0.1);
    //     height: 1px;
    //   }
    //   </style>`,
    //   attributes: {class:'gjs-fonts gjs-f-divider'}
    // });
    // bm.add('text', {
    //   label: opt.textBlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-text'},
    //   content: '<p class="luca" >Insert your text here Luca</p>',
    //   //  style: { padding: '10px' },
    //   //  activeOnRender: 1
    //   // },
    // });
    // bm.add('text-sect', {
    //   label: opt.textSectionBlkLabel,
    //   category: opt.categoryLabel,
    //   content: '<h2 class="heading">Insert title here H2</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua</p>',
    //   attributes: {class:'gjs-fonts gjs-f-h1p'}
    // });
    // bm.add('image', {
    //   label: opt.imageBlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'gjs-fonts gjs-f-image'},
    //   content: {
    //     type:'image',
    //     style: {color:'black'},
    //     activeOnRender: 1
    //   },
    // });
    // bm.add('quote', {
    //   label: opt.quoteBlkLabel,
    //   category: opt.categoryLabel,
    //   content: '<blockquote class="quote">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore ipsum dolor sit</blockquote>',
    //   attributes: {class:'fa fa-quote-right'}
    // });
    // bm.add('link', {
    //   label: opt.linkBlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'fa fa-link'},
    //   content: {
    //     type: 'link',
    //     content: 'Link',
    //     style: {color:'#3b97e3'}
    //   },
    // });
    // bm.add('link-block', {
    //   label: opt.linkBlockBlkLabel,
    //   category: opt.categoryLabel,
    //   attributes: {class:'fa fa-link'},
    //   content: {
    //     type: 'link',
    //     editable: false,
    //     droppable: true,
    //     style: {
    //       display: 'inline-block',
    //       padding: '5px',
    //       'min-height': '50px',
    //       'min-width': '50px'
    //     }
    //   },
    // });
    // let gridItem =
    //   `<table class="grid-item-card">
    //     <tr>
    //       <td class="grid-item-card-cell">
    //         <img class="grid-item-image" src="http://placehold.it/250x150/78c5d6/fff/" alt="Image"/>
    //         <table class="grid-item-card-body">
    //           <tr>
    //             <td class="grid-item-card-content">
    //               <h1 class="card-title">Title here</h1>
    //               <p class="card-text">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt</p>
    //             </td>
    //           </tr>
    //         </table>
    //       </td>
    //     </tr>
    //   </table>`;
    // bm.add('grid-items', {
    //   label: opt.gridItemsBlkLabel,
    //   category: opt.categoryLabel,
    //   content: `<table class="grid-item-row">
    //     <tr>
    //       <td class="grid-item-cell2-l">${gridItem}</td>
    //       <td class="grid-item-cell2-r">${gridItem}</td>
    //     </tr>
    //   </table>`,
    //   attributes: {class:'fa fa-th'}
    // });
    // let listItem =
    //   `<table class="list-item">
    //     <tr>
    //       <td class="list-item-cell">
    //         <table class="list-item-content">
    //           <tr class="list-item-row">
    //             <td class="list-cell-left">
    //               <img class="list-item-image" src="http://placehold.it/150x150/78c5d6/fff/" alt="Image"/>
    //             </td>
    //             <td class="list-cell-right">
    //               <h1 class="card-title">Title here</h1>
    //               <p class="card-text">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt</p>
    //             </td>
    //           </tr>
    //         </table>
    //       </td>
    //     </tr>
    //   </table>`;
    // bm.add('list-items', {
    //   label: opt.listItemsBlkLabel,
    //   category: opt.categoryLabel,
    //   content: listItem + listItem,
    //   attributes: {class:'fa fa-th-list'}
    // });


    return this.editor;
  }

  /**
   * Manage button loading indicator
   *
   * @param activate - true or false
   */
  static setupButtonLoadingIndicator(activate) {
    const builderButton = mQuery('.btn-builder');
    const saveButton = mQuery('.btn-save');
    const applyButton = mQuery('.btn-apply');

    if (activate) {
      Mautic.activateButtonLoadingIndicator(builderButton);
      Mautic.activateButtonLoadingIndicator(saveButton);
      Mautic.activateButtonLoadingIndicator(applyButton);
    } else {
      Mautic.removeButtonLoadingIndicator(builderButton);
      Mautic.removeButtonLoadingIndicator(saveButton);
      Mautic.removeButtonLoadingIndicator(applyButton);
    }
  }

  /**
   * Configure the Asset Manager for all modes
   * @link https://grapesjs.com/docs/modules/Assets.html#configuration
   */
  getAssetManagerConf() {
    return {
      assets: this.assets,
      noAssets: Mautic.translate('grapesjsbuilder.assetManager.noAssets'),
      upload: this.uploadPath,
      uploadName: 'files',
      multiUpload: 1,
      embedAsBase64: false,
      openAssetsOnDrop: 1,
      autoAdd: 1,
      headers: { 'X-CSRF-Token': mauticAjaxCsrf }, // global variable
    };
  }

  getEditor() {
    return this.editor;
  }
  /**
   * Generate assets list from GrapesJs
   */
  // getAssetsList() {
  //   const assetManager = this.editor.AssetManager;
  //   const assets = assetManager.getAll();
  //   const assetsList = [];

  //   assets.forEach((asset) => {
  //     if (asset.get('type') === 'image') {
  //       assetsList.push({
  //         src: asset.get('src'),
  //         width: asset.get('width'),
  //         height: asset.get('height'),
  //       });
  //     } else {
  //       assetsList.push(asset.get('src'));
  //     }
  //   });

  //   return assetsList;
  // }
}
