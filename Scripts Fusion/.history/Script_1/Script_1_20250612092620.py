import adsk.core, adsk.fusion, traceback

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        design = app.activeProduct

        for comp in design.allComponents:
            ui.messageBox(f'Component: {comp.name}')

            # Get Dimensions
            boundingBox = comp.boundingBox
            length = boundingBox.maxPoint.x - boundingBox.minPoint.x
            width  = boundingBox.maxPoint.y - boundingBox.minPoint.y
            height = boundingBox.maxPoint.z - boundingBox.minPoint.z

            ui.messageBox(f'Dimensions (cm):\nLength: {length*10:.2f}, Width: {width*10:.2f}, Height: {height*10:.2f}')

            # Get Material
            material = comp.material.name if comp.material else "No material assigned"
            ui.messageBox(f'Material: {material}')

    except Exception as e:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))
