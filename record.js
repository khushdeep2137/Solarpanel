var records = [];
const getProjects = async () => {
    loader(true);
    const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
        }
    });
    const responseJson = await response.json();
    console.log("list of projects....", responseJson);
    const rows = responseJson.map(list => `
                                  <tr> 
                                 <td>${list.latitude}</td>
                                 <td>${list.longitude}</td>
                                 <td>${list.qty_panels}</td>
                                 <td>${new Date(list.created_at).toISOString()}</td>
                                 <td><a href="arcgis.html?id=${list.id}&lon=${list.longitude}&lat=${list.latitude}">Edit</a></td>
                                 </tr>
                                `);
    const tableBody = document.querySelector('#table-body');
    tableBody.innerHTML = rows.join('');
    loader(false);
}

const getRecords = async () => {
    const response = await fetch('https://api.tadabase.io/api/v1/data-tables/eykNOvrDY3/records', {
        method: 'GET',
        headers: {
            'X-Tadabase-App-id': 'YZjnxPRNPv',
            'X-Tadabase-App-Key': '6Df5SU2Mt1mu',
            'X-Tadabase-App-Secret': 'dixSD4HuMrizbMGfc5VmtuxGvYoivHQg',
            'Cookie': 'AWSALB=ReQwTmnDC5i3YFM3fZe3/ngWKhxc3n0ji9PAVEQCpLAdd3BiMJJimRs1Y4WdoOo+jjccB14rzqJutvpcI5HqqVJtqCSokPzOilXGrfY9OZyEn4zDkDLH4YKW3fHz; AWSALBCORS=ReQwTmnDC5i3YFM3fZe3/ngWKhxc3n0ji9PAVEQCpLAdd3BiMJJimRs1Y4WdoOo+jjccB14rzqJutvpcI5HqqVJtqCSokPzOilXGrfY9OZyEn4zDkDL'
        }
    });
    const responseJson = await response.json();
    records = responseJson.items;
    console.log(records);
    renderList(records);
};

const renderList = (Items) => {
    let items_container = document.querySelector(".dragable_items");
    let items = "";
    for (let item of Items) {
        items += `<div class="item">
                    <div class="dragable_item" >
                      <div>
                       <img id="${item.id}"  draggable="true" src="${'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAgICAgJCAkKCgkNDgwODRMREBARExwUFhQWFBwrGx8bGx8bKyYuJSMlLiZENS8vNUROQj5CTl9VVV93cXecnNEBCAgICAkICQoKCQ0ODA4NExEQEBETHBQWFBYUHCsbHxsbHxsrJi4lIyUuJkQ1Ly81RE5CPkJOX1VVX3dxd5yc0f/CABEIAGAAQgMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAACAAEDBggHBf/aAAgBAQAAAADzK5CzRsHf+O1eNCLx6Z41WY0wqPVHBqzGhFR6q4PXImFlHqfhFajAXePV+e/AjFhYNeZ0rsaYUGr8+1sEzNHrTPNaZCyi1xnOtC4io9W8bryMAFu/f//EABcBAQEBAQAAAAAAAAAAAAAAAAEAAwL/2gAIAQIQAAAA1C50ANDmNAjqiGj/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAQL/2gAIAQMQAAAAgikoBKJqI//EADsQAAECAgYGCAMHBQAAAAAAAAEAAgMEBQYRElOREzJBUZKiFiEjJDFSVWMzQrEUIjRDc6GyFSVis9L/2gAIAQEAAT8ArZWWscpWWmJaXpeZhQYUe6xjSAGi6F0srT65OcQRrTWYnrpuazC6U1m9bm+JGtFZvXJzjRrPWX1uc410lrJ63OcaiVmrIGOIpud8MRXGP++9oc53WSfEkquhaK30/wBmD3refIFa3CGZTnNt+E3Molo/KbmVeGG3Mq8LfhtzKvNJHZN/dRXN0T+ybqnemMeWMIY6wtHgFXLQitlOW6T8Tss8gXd/e5Ufs+6Nyrux2R+VESw2R+Vd13R82oGV8sfNqimW0cTqj6p2tUt+GgWeGjb9FXENNaaaN8C2O08jVdbiDIohuIMirGYgyKNzE/YqxmIMirGYnKVFDNHE7T5T8pUt+Ggfpt+irhDea0UwQPGMz/W1aJ+4ZhGE/cMwtG87BmEYbtwzCMJ+4ZhaNw3ZhRIbjCiauqdoUse7QP02/RVyY41ppUhh+JD2e01Ohv8AI7Iow33fhu4Smw39dsN/CVo33tR/CU6HEw38JTocS7qOyKdDiaGL2btU7CqPhQzISZc3rMCGTwqtT3islLWPd8Zu322oxH4jsyr78R2ZV95/MdmUXuxHZlF7vO7NX3ed2aiPdon/AHzqnapJ3c5X9Fn0VbHFtY6TAA8YWwYLFpH2fLkFpH/45BaR+8ZBGI/eMgjEfvGQWkfvGQUSI/RROsap2BSLiZGUJPXoWfRVucwVkpHs8DacFivswhxFXoeEOIq9DI+EOIovZhDiKL2YQzKvswhmVFe3RROybqnaVR8FzpCTcCADAhnlVb9D0in7dJbZA3YLF3b3uVWy3vcqtlvf5UTK+/yq2V9/lVsr73Koxl9FE6o2qfKqMif22Qs8Ps0L+IVbmDpDNkxACYUs7OAxXG4oyKuMxRkVcZijIosZijIosZijIq5DxhwlRmQtG8acap+UqipiH/TJCwkj7NC/iFWertPT9MxJqTouNGgPlpS5EbdsNkBgKNUa0+jR82f9JtTq2HwoOaPCV0Lrd6BOZBGpVbvQZvJqNTa1gC2g5kcKNTq1eizGbE+pdbXNcBQczyKjYEWDR0lCitLIjJeG17SfBzWgEL//xAAZEQEAAwEBAAAAAAAAAAAAAAABESAxEAD/2gAIAQIBAT8AAiphx6YVMKmFZ9NP/8QAFBEBAAAAAAAAAAAAAAAAAAAAQP/aAAgBAwEBPwB3/9k='}" height="40" width="30" />
                      </div>
                      <div class="item_info">
                       <h5 class="item_name">  ${item.field_59}</h5>
                       <p class="item_description"><b>${item.field_53} </b>${item.field_47} </p>
                      </div>
                    </div>
                   </div>`
    }
    items_container.innerHTML = items;
    const draggables = document.querySelectorAll('[draggable=true]');
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', dragStart);
    });
    function dragStart(event) {
        let panel = records.find(x => x.id == event.target.id);
        if (panel) {
            let obj = {
                width: mmToMeters(panel.field_64), height: mmToMeters(panel.field_65),
                panelId: panel.id, panel: panel
            }
            console.log(obj);
            event.dataTransfer.setData('text/plain', JSON.stringify(obj));
        }
    }
    function mmToMeters(mm) {
        return mm / 1000;
        
    }

}
